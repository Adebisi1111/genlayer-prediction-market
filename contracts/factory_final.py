# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import hashlib
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
    question_hash: str
    rules_hash: str
    status: str
    outcome: str
    total_pool: u256
    positions: str
    claims: str
    dispute_count: u256
    dispute_note: str
    history: str


class PredictionMarketFactory(gl.Contract):
    market_count: u256
    creation_stake: u256
    dispute_stake: u256
    max_disputes: u256
    markets: TreeMap[str, Market]
    user_markets: TreeMap[str, str]
    user_positions: TreeMap[str, str]
    leaderboard: TreeMap[str, str]

    def __init__(self):
        self.market_count = u256(0)
        self.creation_stake = u256(0)  # Free for seeding
        self.dispute_stake = u256(500000000000000000)
        self.max_disputes = u256(3)

    def _load_json(self, raw, default):
        try:
            v = json.loads(raw)
            return v if v is not None else default
        except Exception:
            return default

    def _pools(self, market):
        pos = self._load_json(market.positions, {})
        pools = {}
        for addr, p in pos.items():
            if not isinstance(p, dict):
                continue
            for opt, amt in p.items():
                pools[opt] = pools.get(opt, u256(0)) + u256(int(amt))
        total = u256(0)
        for v in pools.values():
            total += v
        return pools, total

    def _append_history(self, market, kind, note):
        h = self._load_json(market.history, [])
        h.append({"round": len(h) + 1, "kind": kind, "status": market.status, "outcome": market.outcome, "by": str(gl.message.sender_address), "note": note})
        market.history = json.dumps(h)

    @gl.public.write
    def createMarket(self, question: str, rules: str, market_type: str, options: list, source1: str, source2: str, source3: str) -> str:
        sender = gl.message.sender_address.as_hex
        mtype = market_type.strip().upper()
        if mtype not in ("BINARY", "CATEGORICAL", "SCALAR"):
            raise Exception("market_type must be BINARY, CATEGORICAL, or SCALAR")
        if mtype == "BINARY":
            options = ["YES", "NO"]
        if not options or len(options) < 2:
            raise Exception("At least 2 options required")
        if len(question.strip()) < 10:
            raise Exception("Question must be at least 10 characters")
        if len(rules.strip()) < 10:
            raise Exception("Resolution rules must be at least 10 characters")
        if not source1.startswith("http"):
            raise Exception("At least one valid http(s) source required")

        self.market_count += u256(1)
        mid = f"market-{self.market_count}"

        self.markets[mid] = Market(
            market_id=mid, creator=sender, question=question.strip(), rules=rules.strip(),
            market_type=mtype, options=json.dumps(options), source1=source1, source2=source2, source3=source3,
            question_hash=hashlib.sha256(question.encode()).hexdigest(),
            rules_hash=hashlib.sha256(rules.encode()).hexdigest(),
            status="OPEN", outcome="", resolved_at_round=u256(0), total_pool=u256(0),
            positions="{}", claims="{}", dispute_count=u256(0), dispute_note="", history="[]", created_block=u256(0),
        )
        self._append_history(self.markets[mid], "create", f"Created by {sender}")
        um = self._load_json(self.user_markets.get(sender, "[]"), [])
        um.append(mid)
        self.user_markets[sender] = json.dumps(um)
        return mid

    @gl.public.write
    def stake(self, market_id: str, option: str) -> None:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.status != "OPEN":
            raise Exception("Market is not open")
        amt = gl.message.value
        if amt <= u256(0):
            raise Exception("Must send positive GEN")
        options = self._load_json(market.options, [])
        if option not in options:
            raise Exception(f"Invalid option")
        pos = self._load_json(market.positions, {})
        cur = pos.get(sender, {})
        if not isinstance(cur, dict):
            cur = {}
        cur[option] = int(cur.get(option, 0)) + int(amt)
        pos[sender] = cur
        market.positions = json.dumps(pos)
        pools, total = self._pools(market)
        market.total_pool = total
        self.markets[market_id] = market
        self._append_history(market, "stake", f"{sender} staked {int(amt)} on {option}")

    @gl.public.write
    def settle(self, market_id: str) -> None:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.creator != sender:
            raise Exception("Only the market creator can settle")
        if market.status != "RESOLVED":
            raise Exception("Can only settle a resolved market")
        if market.outcome not in self._load_json(market.options, []):
            raise Exception("Cannot settle UNRESOLVED market")
        market.status = "SETTLED"
        self._append_history(market, "settle", "")
        self.markets[market_id] = market

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.status != "SETTLED":
            raise Exception("Market not settled")
        pos = self._load_json(market.positions, {})
        mine = pos.get(sender, {})
        if not isinstance(mine, dict) or not mine:
            raise Exception("No position")
        win = market.outcome
        stake_win = int(mine.get(win, 0))
        if stake_win <= 0:
            raise Exception("No winning stake")
        pools, total = self._pools(market)
        winning_pool = int(pools.get(win, 0))
        if winning_pool <= 0:
            return u256(0)
        payout = u256(stake_win * total // winning_pool)
        claims = self._load_json(market.claims, {})
        prev = claims.get(sender, {})
        if isinstance(prev, dict) and prev.get("claimed"):
            raise Exception("Already claimed")
        claims[sender] = {"claimed": True, "stake": stake_win, "payout": int(payout)}
        market.claims = json.dumps(claims)
        self._append_history(market, "claim", f"payout={int(payout)}")
        self.markets[market_id] = market
        return payout

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        market = self.markets.get(market_id, None)
        if market is None:
            return json.dumps({"exists": False})
        pools, total = self._pools(market)
        return json.dumps({
            "exists": True, "market_id": market.market_id, "creator": market.creator,
            "question": market.question, "rules": market.rules, "market_type": market.market_type,
            "options": self._load_json(market.options, []), "source1": market.source1,
            "status": market.status, "outcome": market.outcome, "total_pool": int(total),
            "pools": {k: int(v) for k, v in pools.items()}, "dispute_count": int(market.dispute_count),
            "history": self._load_json(market.history, []),
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
                pools, total = self._pools(m)
                results.append({"market_id": m.market_id, "question": m.question[:80], "status": m.status, "total_pool": int(total), "outcome": m.outcome})
        return json.dumps({"markets": results, "total": int(self.market_count)})

    @gl.public.view
    def getLeaderboard(self) -> str:
        top = []
        for addr, data in self.leaderboard.items():
            lb = self._load_json(data, {})
            if lb.get("total", 0) > 0:
                top.append({"addr": addr, "wins": int(lb.get("wins", 0)), "total": int(lb.get("total", 0)), "earnings": int(lb.get("earnings", 0))})
        top.sort(key=lambda x: x["earnings"], reverse=True)
        return json.dumps(top[:20])

    @gl.public.view
    def getConfig(self) -> str:
        return json.dumps({"creation_stake": int(self.creation_stake), "dispute_stake": int(self.dispute_stake), "max_disputes": int(self.max_disputes), "market_count": int(self.market_count)})
