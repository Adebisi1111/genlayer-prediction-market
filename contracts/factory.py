# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""PrimeX — canonical GenLayer prediction market factory.

Resolution is the GenLayer-native part: each market stores a cited source URL,
and `resolve()` has every validator independently fetch that source, judge the
question against it with an LLM, and agree through comparative consensus. No
oracle, no admin verdict.

Payout is parimutuel; winners are paid native GEN. Paying an EOA is an EXTERNAL
message, so it must go through the EVM interface (the ghost contract) --
gl.get_contract_at(wallet).emit_transfer() is IC->IC only and silently moves
nothing.
"""

from genlayer import *


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


class Factory(gl.Contract):
    market_count: u256
    # market_id -> creator | question | source_url | status | outcome
    m_creator: TreeMap[str, str]
    m_question: TreeMap[str, str]
    m_source: TreeMap[str, str]
    m_status: TreeMap[str, str]
    m_outcome: TreeMap[str, str]
    m_pool: TreeMap[str, u256]
    # "addr:SIDE:amt|addr:SIDE:amt|..." per market, plus "mid:addr" -> "1" claims
    m_positions: TreeMap[str, str]

    @gl.public.write
    def createMarket(self, question: str, source_url: str) -> str:
        """Create a market. The source URL is the evidence validators will read."""
        if not question:
            raise gl.vm.UserError("Question required")
        if not source_url.startswith("http"):
            raise gl.vm.UserError("Source URL required (http/https)")
        sender = gl.message.sender_address.as_hex
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.m_creator[mid] = sender
        self.m_question[mid] = question
        self.m_source[mid] = source_url
        self.m_status[mid] = "OPEN"
        self.m_outcome[mid] = ""
        self.m_pool[mid] = u256(0)
        self.m_positions[mid] = ""
        return mid

    @gl.public.write.payable
    def stake(self, market_id: str, option: str) -> None:
        """Stake GEN on YES or NO. Rejects anything else."""
        if option not in ("YES", "NO"):
            raise gl.vm.UserError("Side must be YES or NO")
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Market not open")
        amt = gl.message.value
        if amt <= u256(0):
            raise gl.vm.UserError("Must send GEN")
        sender = gl.message.sender_address.as_hex
        self.m_pool[market_id] = u256(int(self.m_pool.get(market_id, u256(0))) + int(amt))
        pos = self.m_positions.get(market_id, "")
        entry = f"{sender}:{option}:{int(amt)}"
        self.m_positions[market_id] = (pos + "|" + entry) if pos else entry

    @gl.public.write
    def resolve(self, market_id: str) -> str:
        """Resolve from the cited source through validator consensus.

        Every validator fetches the market's source URL itself and judges the
        question against it. Comparative consensus reconciles their verdicts, so
        the outcome is the network's, not the caller's.
        """
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Already resolved")

        question = self.m_question.get(market_id, "")
        source = self.m_source.get(market_id, "")

        def _judge() -> str:
            page = gl.nondet.web.render(source, mode="text")
            # Keep only lines that mention the question's key terms. Validators
            # each fetch the page themselves and a raw prefix slice of a large,
            # frequently-edited page differs between them, which starves the
            # equivalence principle of agreement. Filtering to relevant lines
            # makes the judged input stable across fetches.
            terms = [w.strip("?$,.").lower() for w in question.split() if len(w) > 3]
            hits = []
            for line in page.splitlines():
                ls = line.strip()
                if len(ls) < 20:
                    continue
                low = ls.lower()
                if any(t in low for t in terms):
                    hits.append(ls)
                if len(hits) >= 40:
                    break
            evidence = "\n".join(hits) if hits else page[:2000]

            verdict = gl.nondet.exec_prompt(
                "You are resolving a prediction market from a cited source.\n"
                f"QUESTION: {question}\n\n"
                f"SOURCE EXCERPTS:\n{evidence[:4000]}\n\n"
                "Answer with exactly one word: YES if the excerpts show the "
                "question resolved true, NO if they show it resolved false, or "
                "UNKNOWN if they do not settle it. One word only."
            )
            v = verdict.strip().upper()
            # Check UNKNOWN first: a substring scan would match the "NO" inside
            # "UNKNOWN" and silently resolve an unsettled market against NO.
            if "UNKNOWN" in v:
                return "UNKNOWN"
            if "YES" in v:
                return "YES"
            if "NO" in v:
                return "NO"
            return "UNKNOWN"

        # Comparative returns _judge()'s own value verbatim, which is what we
        # need for a strict YES/NO/UNKNOWN token. (prompt_non_comparative pipes
        # the leader's output through a second LLM template, so the return is
        # prose rather than the bare verdict.) Agreement therefore depends on
        # the judged input being stable across validators -- hence the filtered
        # evidence above rather than a raw page slice.
        outcome = gl.eq_principle.prompt_comparative(
            _judge,
            "Both must give the same one-word verdict (YES, NO, or UNKNOWN) "
            f"for: {question}",
        )

        decided = str(outcome).strip().upper()
        if decided not in ("YES", "NO"):
            # Validators could not agree the source settles it -- stay OPEN so the
            # market can be resolved again once better evidence exists.
            raise gl.vm.UserError("Source does not settle this question yet")

        self.m_status[market_id] = "RESOLVED"
        self.m_outcome[market_id] = decided
        return decided

    @gl.public.write
    def settle(self, market_id: str) -> None:
        """Lock the resolved outcome so claims can open."""
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "RESOLVED":
            raise gl.vm.UserError("Not resolved")
        self.m_status[market_id] = "SETTLED"

    def _payout_for(self, market_id: str, who: str) -> int:
        """Parimutuel: winning_stake * total_pool // winning_pool."""
        outcome = self.m_outcome.get(market_id, "")
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        user_stake = 0
        winning_pool = 0
        for p in self.m_positions.get(market_id, "").split("|"):
            if not p:
                continue
            pp = p.split(":")
            if len(pp) < 3:
                continue
            if pp[1] == outcome:
                # Accumulate every entry -- a wallet may stake many times.
                winning_pool += int(pp[2])
                if pp[0] == who:
                    user_stake += int(pp[2])
        if user_stake <= 0 or winning_pool <= 0:
            return 0
        return (user_stake * total_pool) // winning_pool

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        """Pay the winner their parimutuel share in native GEN, once."""
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED":
            raise gl.vm.UserError("Not settled")
        sender = gl.message.sender_address.as_hex
        key = f"{market_id}:{sender}"
        if self.m_positions.get(key, "") == "1":
            raise gl.vm.UserError("Already claimed")
        payout = self._payout_for(market_id, sender)
        if payout <= 0:
            raise gl.vm.UserError("No winning stake")
        # Mark before transferring; a failed external message reverts the whole call.
        self.m_positions[key] = "1"
        _Payee(gl.message.sender_address).emit_transfer(value=u256(payout))
        return u256(payout)

    @gl.public.view
    def isClaimed(self, market_id: str, user: str) -> str:
        return "1" if self.m_positions.get(f"{market_id}:{user}", "") == "1" else "0"

    @gl.public.view
    def previewPayout(self, market_id: str, user: str) -> str:
        if self.m_status.get(market_id, "") != "SETTLED":
            return "0"
        return str(self._payout_for(market_id, user))

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        if self.m_creator.get(market_id, None) is None:
            return "NOT_FOUND"
        return (
            f"{self.m_question.get(market_id,'')}"
            f"|{self.m_status.get(market_id,'')}"
            f"|{self.m_outcome.get(market_id,'')}"
            f"|{int(self.m_pool.get(market_id, u256(0)))}"
            f"|{self.m_positions.get(market_id,'')}"
            f"|{self.m_source.get(market_id,'')}"
        )

    @gl.public.view
    def getSource(self, market_id: str) -> str:
        return self.m_source.get(market_id, "")

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
