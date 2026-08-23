# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class PredictionMarketFactory(gl.Contract):
    market_count: u256
    markets: TreeMap[str, str]

    @gl.public.write
    def createMarket(self, question: str) -> str:
        sender = gl.message.sender_address.as_hex
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        # Store as pipe-separated string: creator|question|status|outcome|total_pool|positions
        self.markets[mid] = f"{sender}|{question}|OPEN||0|"
        return mid

    @gl.public.write
    def stake(self, market_id: str, option: str) -> None:
        sender = gl.message.sender_address.as_hex
        raw = self.markets.get(market_id, None)
        if raw is None:
            raise Exception("Market not found")
        
        parts = raw.split("|")
        status = parts[2]
        if status != "OPEN":
            raise Exception("Not open")
        
        amt = gl.message.value
        if amt <= u256(0):
            raise Exception("Must send GEN")
        
        # Update pool
        total_pool = int(parts[4]) + int(amt)
        parts[4] = str(total_pool)
        
        # Update positions: append "sender:option:amt"
        positions = parts[5]
        if positions:
            parts[5] = positions + f"|{sender}:{option}:{int(amt)}"
        else:
            parts[5] = f"{sender}:{option}:{int(amt)}"
        
        self.markets[market_id] = "|".join(parts)

    @gl.public.write
    def resolve(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        raw = self.markets.get(market_id, None)
        if raw is None:
            raise Exception("Market not found")
        
        parts = raw.split("|")
        if parts[0] != sender:
            raise Exception("Only creator")
        if parts[2] != "OPEN":
            raise Exception("Already resolved")
        
        parts[2] = "RESOLVED"
        parts[3] = "YES"  # Simplified
        self.markets[market_id] = "|".join(parts)

    @gl.public.write
    def settle(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        raw = self.markets.get(market_id, None)
        if raw is None:
            raise Exception("Market not found")
        
        parts = raw.split("|")
        if parts[0] != sender:
            raise Exception("Only creator")
        if parts[2] != "RESOLVED":
            raise Exception("Not resolved")
        
        parts[2] = "SETTLED"
        self.markets[market_id] = "|".join(parts)

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        sender = gl.message.sender_address.as_hex
        raw = self.markets.get(market_id, None)
        if raw is None:
            raise Exception("Market not found")
        
        parts = raw.split("|")
        if parts[2] != "SETTLED":
            raise Exception("Not settled")
        
        outcome = parts[3]
        total_pool = int(parts[4])
        positions = parts[5]
        
        # Find user's stake
        user_stake = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if pp[0] == sender and pp[1] == outcome:
                user_stake = int(pp[2])
                break
        
        if user_stake <= 0:
            raise Exception("No winning stake")
        
        # Calculate winning pool
        winning_pool = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if pp[1] == outcome:
                winning_pool += int(pp[2])
        
        if winning_pool <= 0:
            return u256(0)
        
        payout = u256(user_stake * total_pool // winning_pool)
        return payout

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        raw = self.markets.get(market_id, None)
        if raw is None:
            return "NOT_FOUND"
        return raw

    @gl.public.view
    def getMarketsPage(self, page: int, limit: int) -> str:
        start = (page - 1) * limit + 1
        end = start + limit
        results = []
        for i in range(start, end + 1):
            mid = f"market-{i}"
            m = self.markets.get(mid, None)
            if m:
                results.append(m)
        return "|".join(results)

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
