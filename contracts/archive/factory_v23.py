# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from genlayer.py.storage import DynArray


class Factory(gl.Contract):
    market_count: u256
    m_creator: TreeMap[str, str]
    m_question: TreeMap[str, str]
    m_status: TreeMap[str, str]
    m_outcome: TreeMap[str, str]
    m_pool: TreeMap[str, u256]
    m_positions: TreeMap[str, str]
    # "market-N:0xADDR" -> "1" once claimed. Readable, unlike a DynArray scan.
    claims: TreeMap[str, str]

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
        amt = gl.message.value
        if amt <= u256(0):
            raise Exception("Must send GEN")
        self.m_pool[market_id] = u256(int(self.m_pool.get(market_id, u256(0))) + int(amt))
        pos = self.m_positions.get(market_id, "")
        entry = f"{sender}:{option}:{int(amt)}"
        self.m_positions[market_id] = (pos + "|" + entry) if pos else entry

    @gl.public.write
    def resolve(self, market_id: str, outcome: str) -> None:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_creator.get(market_id, "") != sender:
            raise Exception("Only creator")
        if self.m_status.get(market_id, "") != "OPEN":
            raise Exception("Already resolved")
        if outcome not in ("YES", "NO"):
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

    def _payout_for(self, market_id: str, who: str) -> int:
        outcome = self.m_outcome.get(market_id, "")
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        positions = self.m_positions.get(market_id, "")
        user_stake = 0
        winning_pool = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if len(pp) < 3:
                continue
            if pp[1] == outcome:
                winning_pool += int(pp[2])
                if pp[0] == who:
                    user_stake += int(pp[2])
        if user_stake <= 0 or winning_pool <= 0:
            return 0
        return user_stake * total_pool // winning_pool

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        """Pay the winner directly. Nothing is zeroed until the transfer is emitted,
        so a failed transfer reverts the whole call and the claim stays available."""
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED":
            raise Exception("Not settled")
        key = f"{market_id}:{sender}"
        if self.claims.get(key, "") == "1":
            raise Exception("Already claimed")
        payout = self._payout_for(market_id, sender)
        if payout <= 0:
            raise Exception("No winning stake")
        self.claims[key] = "1"
        gl.get_contract_at(gl.message.sender_address).emit_transfer(
            value=u256(payout), on="accepted"
        )
        return u256(payout)

    @gl.public.view
    def isClaimed(self, market_id: str, user: str) -> str:
        return "1" if self.claims.get(f"{market_id}:{user}", "") == "1" else "0"

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
        )

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
