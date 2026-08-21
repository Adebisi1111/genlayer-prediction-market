# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class Market:
    market_id: str
    creator: str
    question: str
    rules: str
    market_type: str
    options: str
    source1: str
    source2: str
    source3: str
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
    def createMarket(self, question: str, rules: str, market_type: str, options: list, source1: str, source2: str, source3: str) -> str:
        sender = gl.message.sender_address.as_hex
        mtype = market_type.strip().upper()
        if mtype not in ("BINARY", "CATEGORICAL", "SCALAR"):
            raise Exception("Invalid market_type")
        if mtype == "BINARY":
            options = ["YES", "NO"]
        if not options or len(options) < 2:
            raise Exception("At least 2 options")
        if len(question.strip()) < 5:
            raise Exception("Question too short")
        if len(rules.strip()) < 5:
            raise Exception("Rules too short")
        if not source1.startswith("http"):
            raise Exception("Source must be URL")

        self.market_count += u256(1)
        mid = f"market-{self.market_count}"

        self.markets[mid] = Market(
            market_id=mid, creator=sender, question=question.strip(), rules=rules.strip(),
            market_type=mtype, options=json.dumps(options), source1=source1, source2=source2, source3=source3,
            status="OPEN", outcome="", total_pool=u256(0),
            positions="{}", claims="{}",
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
        options = json.loads(market.options)
        if option not in options:
            raise Exception("Invalid option")
        pos = json.loads(market.positions)
        cur = pos.get(sender, {})
        if not isinstance(cur, dict):
            cur = {}
        cur[option] = int(cur.get(option, 0)) + int(amt)
        pos[sender] = cur
        market.positions = json.dumps(pos)
        market.total_pool = u256(int(market.total_pool) + int(amt))
        self.markets[market_id] = market

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        market = self.markets.get(market_id, None)
        if market is None:
            return json.dumps({"exists": False})
        return json.dumps({
            "exists": True, "market_id": market.market_id, "creator": market.creator,
            "question": market.question, "rules": market.rules, "market_type": market.market_type,
            "options": json.loads(market.options), "source1": market.source1,
            "status": market.status, "outcome": market.outcome, "total_pool": int(market.total_pool),
        })

    @gl.public.view
    def getMarketsPage(self, page: int, limit: int) -> str:
        start = (page - 1) * limit + 1
        end = start + limit
        results = []
        for i in range(start, end + 1):
            mid = f"market-{i}"
            m = self.markets.get(mid, None)
            if m:
                results.append({
                    "market_id": m.market_id, "question": m.question[:80],
                    "status": m.status, "total_pool": int(m.total_pool),
                    "outcome": m.outcome,
                })
        return json.dumps({"markets": results, "total": int(self.market_count)})

    @gl.public.view
    def getConfig(self) -> str:
        return json.dumps({"market_count": int(self.market_count)})
