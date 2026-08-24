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
    claimed: DynArray[str]

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
        if pos:
            self.m_positions[market_id] = pos + f"|{sender}:{option}:{int(amt)}"
        else:
            self.m_positions[market_id] = f"{sender}:{option}:{int(amt)}"

    @gl.public.write
    def resolve(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_creator.get(market_id, "") != sender:
            raise Exception("Only creator")
        if self.m_status.get(market_id, "") != "OPEN":
            raise Exception("Already resolved")
        self.m_status[market_id] = "RESOLVED"
        self.m_outcome[market_id] = "YES"

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

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        sender = gl.message.sender_address.as_hex
        if self.m_creator.get(market_id, None) is None:
            raise Exception("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED":
            raise Exception("Not settled")
        
        claim_key = f"{market_id}:{sender}"
        for c in self.claimed:
            if c == claim_key:
                raise Exception("Already claimed")
        
        outcome = self.m_outcome.get(market_id, "")
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        positions = self.m_positions.get(market_id, "")
        
        user_stake = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if pp[0] == sender and pp[1] == outcome:
                user_stake += int(pp[2])
        
        if user_stake <= 0:
            raise Exception("No winning stake")
        
        winning_pool = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if pp[1] == outcome:
                winning_pool += int(pp[2])
        
        if winning_pool <= 0:
            raise Exception("Winning pool is zero")
        
        payout = user_stake * total_pool // winning_pool
        if payout <= 0:
            raise Exception("Payout is zero")
        
        # Record claim BEFORE transfer
        self.claimed.append(claim_key)
        
        # REAL GEN payout with on='accepted' to avoid finalization stall
        gl.get_contract_at(gl.message.sender_address).emit_transfer(value=u256(payout), on='accepted')
        return u256(payout)

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        if self.m_creator.get(market_id, None) is None:
            return "NOT_FOUND"
        return f"{self.m_question.get(market_id,'')}|{self.m_status.get(market_id,'')}|{self.m_outcome.get(market_id,'')}|{int(self.m_pool.get(market_id, u256(0)))}|{self.m_positions.get(market_id,'')}"

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
