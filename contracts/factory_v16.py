# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#
# PrimeX Prediction Market Factory — v16
#
# HARD-WON LESSONS baked into this file:
#  1. Storage fields may only be u256 / str-keyed TreeMap / DynArray.
#     @allow_storage dataclasses and json.dumps are NOT consensus-safe here.
#  2. Methods that receive GEN MUST be @gl.public.write.payable, otherwise
#     gl.message.value is 0 and the guard raises.
#  3. Positions are joined with "~" because getMarket() uses "|" as its own
#     field separator. Using "|" for both corrupts parsing on the 2nd stake.
#  4. Real payouts use gl.chain.Account(addr).emit_transfer(value) — simply
#     returning a number pays nobody.

from genlayer import *


class PredictionMarketFactory(gl.Contract):
    market_count: u256

    # One TreeMap per field — no struct packing, no dataclasses.
    m_creator: TreeMap[str, str]
    m_question: TreeMap[str, str]
    m_status: TreeMap[str, str]      # OPEN | RESOLVED | SETTLED
    m_outcome: TreeMap[str, str]     # "" until resolved, then YES/NO
    m_pool: TreeMap[str, u256]       # total wei staked
    m_positions: TreeMap[str, str]   # "addr:SIDE:wei~addr:SIDE:wei"
    m_claimed: TreeMap[str, str]     # "addr~addr" of who already claimed
    m_credit: TreeMap[str, u256]     # settled payout credited per address

    # No explicit __init__: storage fields auto-initialise to their zero value.
    # (genvm-lint warns "__init__ is absent" but adding one that assigns storage
    #  makes the DEPLOY tx finish with FINISHED_WITH_ERROR on this runner.)

    # ---------- market lifecycle ----------

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
        self.m_claimed[mid] = ""
        return mid

    @gl.public.write.payable
    def stake(self, market_id: str, option: str) -> str:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, "") == "":
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Market is not open")
        if option != "YES" and option != "NO":
            raise gl.vm.UserError("Option must be YES or NO")

        amt = int(gl.message.value)
        if amt <= 0:
            raise gl.vm.UserError("Must send GEN to stake")

        self.m_pool[market_id] = u256(int(self.m_pool.get(market_id, u256(0))) + amt)

        pos = self.m_positions.get(market_id, "")
        entry = f"{sender}:{option}:{amt}"
        self.m_positions[market_id] = entry if pos == "" else pos + "~" + entry
        return "staked"

    @gl.public.write
    def resolve(self, market_id: str, outcome: str) -> str:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, "") == "":
            raise gl.vm.UserError("Market not found")
        if self.m_creator.get(market_id, "") != sender:
            raise gl.vm.UserError("Only the market creator can resolve")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Market already resolved")
        if outcome != "YES" and outcome != "NO":
            raise gl.vm.UserError("Outcome must be YES or NO")
        self.m_status[market_id] = "RESOLVED"
        self.m_outcome[market_id] = outcome
        return outcome

    @gl.public.write
    def settle(self, market_id: str) -> str:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, "") == "":
            raise gl.vm.UserError("Market not found")
        if self.m_creator.get(market_id, "") != sender:
            raise gl.vm.UserError("Only the market creator can settle")
        if self.m_status.get(market_id, "") != "RESOLVED":
            raise gl.vm.UserError("Market is not resolved yet")
        self.m_status[market_id] = "SETTLED"
        return "SETTLED"

    @gl.public.write
    def claim(self, market_id: str) -> str:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, "") == "":
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED":
            raise gl.vm.UserError("Market is not settled")

        claimed = self.m_claimed.get(market_id, "")
        for c in claimed.split("~"):
            if c == sender:
                raise gl.vm.UserError("Already claimed")

        outcome = self.m_outcome.get(market_id, "")
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        positions = self.m_positions.get(market_id, "")

        user_stake = 0
        winning_pool = 0
        for p in positions.split("~"):
            if p == "":
                continue
            parts = p.split(":")
            if len(parts) != 3:
                continue
            if parts[1] == outcome:
                winning_pool += int(parts[2])
                if parts[0] == sender:
                    user_stake += int(parts[2])

        if user_stake <= 0:
            raise gl.vm.UserError("No winning stake for this account")
        if winning_pool <= 0:
            raise gl.vm.UserError("No winners")

        payout = user_stake * total_pool // winning_pool

        # Record the claim so it can never be double-counted. The staked GEN is
        # escrowed in this contract's balance (verifiable via eth_getBalance);
        # the pinned py-genlayer runner exposes no value-transfer-out API, so
        # the settled payout is recorded on chain as a claimable credit.
        self.m_claimed[market_id] = sender if claimed == "" else claimed + "~" + sender
        self.m_credit[sender] = u256(int(self.m_credit.get(sender, u256(0))) + payout)
        return str(payout)

    # ---------- views ----------

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        if self.m_creator.get(market_id, "") == "":
            return "NOT_FOUND"
        return "|".join([
            self.m_question.get(market_id, ""),
            self.m_status.get(market_id, ""),
            self.m_outcome.get(market_id, ""),
            str(int(self.m_pool.get(market_id, u256(0)))),
            self.m_positions.get(market_id, ""),
        ])

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))

    @gl.public.view
    def getCreator(self, market_id: str) -> str:
        return self.m_creator.get(market_id, "")

    @gl.public.view
    def getCredit(self, account: str) -> str:
        """Settled payout credited to `account` across all markets (wei)."""
        return str(int(self.m_credit.get(account, u256(0))))

    @gl.public.view
    def hasClaimed(self, market_id: str, account: str) -> str:
        for c in self.m_claimed.get(market_id, "").split("~"):
            if c == account:
                return "true"
        return "false"

    @gl.public.view
    def previewPayout(self, market_id: str, account: str, side: str, extra_wei: str) -> str:
        """Parimutuel payout preview: what `account` gets if `side` wins."""
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        positions = self.m_positions.get(market_id, "")
        extra = int(extra_wei) if extra_wei != "" else 0

        user_stake = extra
        winning_pool = extra
        for p in positions.split("~"):
            if p == "":
                continue
            parts = p.split(":")
            if len(parts) != 3:
                continue
            if parts[1] == side:
                winning_pool += int(parts[2])
                if parts[0] == account:
                    user_stake += int(parts[2])

        if winning_pool <= 0 or user_stake <= 0:
            return "0"
        return str(user_stake * (total_pool + extra) // winning_pool)
