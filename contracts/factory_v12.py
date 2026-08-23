# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class Market:
    market_id: str
    creator: str
    question: str
    status: str
    outcome: str
    total_pool: u256
    positions: str
    claims: str


class PredictionMarketFactory(gl.Contract):
    market_count: u256
    markets: TreeMap[str, Market]

    def __init__(self):
        pass

    @gl.public.write
    def createMarket(self, question: str) -> str:
        sender = gl.message.sender_address.as_hex
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.markets[mid] = Market(
            market_id=mid,
            creator=sender,
            question=question,
            status="OPEN",
            outcome="",
            total_pool=u256(0),
            positions="",
            claims="",
        )
        return mid

    @gl.public.write
    def stake(self, market_id: str, option: str) -> None:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.status != "OPEN":
            raise Exception("Not open")
        amt = gl.message.value
        if amt <= u256(0):
            raise Exception("Must send GEN")

        pos = market.positions
        if pos:
            parts = pos.split("|")
            found = False
            for i, p in enumerate(parts):
                if p.startswith(sender + ":"):
                    existing = p.split(":")
                    existing_amt = int(existing[2]) + int(amt)
                    parts[i] = f"{sender}:{option}:{existing_amt}"
                    found = True
                    break
            if not found:
                parts.append(f"{sender}:{option}:{int(amt)}")
            market.positions = "|".join(parts)
        else:
            market.positions = f"{sender}:{option}:{int(amt)}"

        market.total_pool = u256(int(market.total_pool) + int(amt))
        self.markets[market_id] = market

    @gl.public.write
    def resolve(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.creator != sender:
            raise Exception("Only creator")
        if market.status != "OPEN":
            raise Exception("Already resolved")
        market.status = "RESOLVED"
        market.outcome = "YES"
        self.markets[market_id] = market

    @gl.public.write
    def settle(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.creator != sender:
            raise Exception("Only creator")
        if market.status != "RESOLVED":
            raise Exception("Not resolved")
        market.status = "SETTLED"
        self.markets[market_id] = market

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.status != "SETTLED":
            raise Exception("Not settled")

        pos = market.positions
        if not pos:
            raise Exception("No position")

        for p in pos.split("|"):
            if p.startswith(sender + ":"):
                parts = p.split(":")
                option = parts[1]
                stake_amt = int(parts[2])
                if option == market.outcome:
                    winning_pool = 0
                    total_pool = int(market.total_pool)
                    for pp in pos.split("|"):
                        pp_parts = pp.split(":")
                        if pp_parts[1] == market.outcome:
                            winning_pool += int(pp_parts[2])
                    if winning_pool > 0:
                        payout = u256(stake_amt * total_pool // winning_pool)
                        claims = market.claims
                        if claims:
                            claims += f"|{sender}:{int(payout)}"
                        else:
                            claims = f"{sender}:{int(payout)}"
                        market.claims = claims
                        self.markets[market_id] = market
                        return payout
                break

        raise Exception("No winning stake")

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        market = self.markets.get(market_id, None)
        if market is None:
            return "NOT_FOUND"
        return f"{market.market_id}|{market.question}|{market.status}|{market.outcome}|{int(market.total_pool)}|{market.positions}|{market.claims}"

    @gl.public.view
    def getMarketsPage(self, page: int, limit: int) -> str:
        start = (page - 1) * limit + 1
        end = start + limit
        results = []
        for i in range(start, end + 1):
            mid = f"market-{i}"
            m = self.markets.get(mid, None)
            if m:
                results.append(f"{m.market_id}|{m.question[:80]}|{m.status}|{int(m.total_pool)}|{m.outcome}")
        return "|".join(results)

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
