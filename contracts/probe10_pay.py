# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#
# PrimeX Factory v19 — parimutuel prediction market WITH REAL GEN PAYOUTS.
#
# ── Hard-won constraints for this runner (do NOT regress) ───────────────────
# 1. PAYOUT PRIMITIVE (discovered by enumerating `dir(gl)` on chain):
#        gl.get_contract_at(Address(to)).emit_transfer(value=u256(amount))
#    `gl.chain.Account(...)` is a v0.3.0 API and does NOT exist here.
#    Emitted transfers use onAcceptance=False → value moves at FINALIZATION,
#    which is later than ACCEPTED. That delay is normal, not a failure.
# 2. STORAGE FIELD LIMIT: 6 fields deploy fine, 8 fine, **10 fails** with
#    FINISHED_WITH_ERROR at deploy. v18 had 9 and failed. Keep the field count
#    low — pack extra state into existing TreeMaps instead of adding fields.
# 3. Only u256 / TreeMap / DynArray. NO @allow_storage dataclasses, NO json
#    (neither is deterministic in consensus).
# 4. NO explicit __init__ — the linter asks for one, but adding it errors on
#    deploy with this runner. Storage fields auto-initialise.
# 5. Bare `Exception` is fine; the linter's gl.vm.UserError advice is for a
#    newer runner.

from genlayer import *


class Factory(gl.Contract):
    market_count: u256
    m_creator: TreeMap[str, str]
    m_question: TreeMap[str, str]
    m_status: TreeMap[str, str]
    m_outcome: TreeMap[str, str]
    m_pool: TreeMap[str, u256]
    m_positions: TreeMap[str, str]
    # Claim ledger, keyed "<market_id>~<address>" -> paid amount as str.
    # Packed into ONE map to stay under the storage-field limit.
    m_claims: TreeMap[str, str]

    # ---------------- internal helpers ----------------

    def _stake_of(self, positions: str, who: str, side: str) -> int:
        """Sum ALL stakes by `who` on `side`.

        v15 bug: it `break`ed after the first match, underpaying anyone who
        staked more than once. Sum every entry instead.
        """
        total = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if len(pp) < 3:
                continue
            if pp[0] == who and pp[1] == side:
                total += int(pp[2])
        return total

    def _side_pool(self, positions: str, side: str) -> int:
        total = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if len(pp) < 3:
                continue
            if pp[1] == side:
                total += int(pp[2])
        return total

    # ---------------- market lifecycle ----------------

    @gl.public.write
    def createMarket(self, question: str) -> str:
        sender = gl.message.sender_address.as_hex
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.m_creator[mid] = sender
        self.m_question[mid] = question
        self.m_status[mid] = "OPEN"
        self.m_outcome[mid] = ""
        self.m_pool[mid] = u256(0)
        self.m_positions[mid] = ""
        return mid

    @gl.public.write.payable
    def stake(self, market_id: str, option: str) -> None:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise Exception("Not open")
        if option != "YES" and option != "NO":
            raise Exception("Option must be YES or NO")
        amt = gl.message.value
        if amt <= u256(0):
            raise Exception("Must send GEN")

        self.m_pool[market_id] = u256(int(self.m_pool.get(market_id, u256(0))) + int(amt))
        entry = f"{sender}:{option}:{int(amt)}"
        pos = self.m_positions.get(market_id, "")
        self.m_positions[market_id] = (pos + "|" + entry) if pos else entry

    @gl.public.write
    def resolve(self, market_id: str, outcome: str) -> None:
        """Resolve with an explicit outcome (v15 hardcoded YES)."""
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_creator.get(market_id, "") != sender:
            raise Exception("Only creator")
        if self.m_status.get(market_id, "") != "OPEN":
            raise Exception("Already resolved")
        if outcome != "YES" and outcome != "NO":
            raise Exception("Outcome must be YES or NO")
        self.m_status[market_id] = "RESOLVED"
        self.m_outcome[market_id] = outcome

    @gl.public.write
    def settle(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_creator.get(market_id, "") != sender:
            raise Exception("Only creator")
        if self.m_status.get(market_id, "") != "RESOLVED":
            raise Exception("Not resolved")
        self.m_status[market_id] = "SETTLED"

    # ---------------- payout ----------------

    @gl.public.write
    def claim(self, market_id: str) -> str:
        """Pay the caller their parimutuel share IN REAL GEN."""
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED":
            raise Exception("Not settled")

        key = market_id + "~" + sender
        if self.m_claims.get(key, "") != "":
            raise Exception("Already claimed")

        outcome = self.m_outcome.get(market_id, "")
        positions = self.m_positions.get(market_id, "")
        total_pool = int(self.m_pool.get(market_id, u256(0)))

        user_stake = self._stake_of(positions, sender, outcome)
        if user_stake <= 0:
            raise Exception("No winning stake")

        winning_pool = self._side_pool(positions, outcome)
        if winning_pool <= 0:
            raise Exception("Empty winning pool")

        payout = user_stake * total_pool // winning_pool
        if payout <= 0:
            raise Exception("Nothing to pay")

        # Record BEFORE transferring (reentrancy-safe ordering).
        self.m_claims[key] = str(payout)

        # REAL GEN transfer — the piece v15 was missing.
        gl.get_contract_at(gl.message.sender_address).emit_transfer(value=u256(payout))
        return str(payout)

    # ---------------- views ----------------

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        if self.m_creator.get(market_id, None) is None:
            return "NOT_FOUND"
        return (
            f"{self.m_question.get(market_id,'')}|{self.m_status.get(market_id,'')}"
            f"|{self.m_outcome.get(market_id,'')}|{int(self.m_pool.get(market_id, u256(0)))}"
            f"|{self.m_positions.get(market_id,'')}"
        )

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))

    @gl.public.view
    def previewPayout(self, market_id: str, account: str, side: str) -> str:
        positions = self.m_positions.get(market_id, "")
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        mine = self._stake_of(positions, account, side)
        side_pool = self._side_pool(positions, side)
        if mine <= 0 or side_pool <= 0:
            return "0"
        return str(mine * total_pool // side_pool)

    @gl.public.view
    def claimedAmount(self, market_id: str, account: str) -> str:
        """"0" means not yet claimed; otherwise the GEN amount paid."""
        return self.m_claims.get(market_id + "~" + account, "0")

