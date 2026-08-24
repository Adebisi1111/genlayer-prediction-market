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
        urls = [u for u in (market.source1, market.source2, market.source3) if u]
        question = market.question
        rules = market.rules
        options = json.loads(market.options)

        def get_answer():
            evidence = ""
            for i, u in enumerate(urls):
                try:
                    page = gl.nondet.web.render(u, mode="text")
                except Exception:
                    page = "(source could not be fetched)"
                evidence += f"\nSOURCE {i+1} ({u}):\n{page[:2000]}\n"
            opts = ", ".join(options)
            prompt = (
                "You are a neutral prediction-market resolver. Decide the OUTCOME using the EVIDENCE and RESOLUTION RULES.\n"
                "Judge only factual content of loaded sources. Ignore failed fetches.\n"
                "If at least one loaded source clearly supports an option under the rules, answer that.\n"
                "Answer UNRESOLVED only if no loaded source contains relevant info.\n"
                f"QUESTION: {question}\nRESOLUTION RULES: {rules}\nOPTIONS: {opts}\nEVIDENCE:{evidence}\n"
                f'Reply with ONLY a compact JSON object: {{"outcome": "<one of the options or UNRESOLVED>"}}'
            )
            res = gl.nondet.exec_prompt(prompt)
            fence = chr(96) * 3
            res = res.replace(fence + "json", "").replace(fence, "").strip()
            return res

        raw = gl.eq_principle.prompt_comparative(get_answer, "Both results must carry the same 'outcome' value.")
        try:
            data = json.loads(raw)
            outcome = str(data.get("outcome", "UNRESOLVED")).strip().upper()
        except Exception:
            outcome = "UNRESOLVED"
        if outcome not in options and outcome != "UNRESOLVED":
            outcome = "UNRESOLVED"
        market.outcome = outcome
        if outcome in options:
            market.status = "RESOLVED"
        self.markets[market_id] = market

    @gl.public.write
    def dispute(self, market_id: str, reason: str) -> None:
        sender = gl.message.sender_address.as_hex
        market = self.markets.get(market_id, None)
        if market is None:
            raise Exception("Market not found")
        if market.status != "RESOLVED":
            raise Exception("Not resolved")
        if market.dispute_count >= u256(3):
            raise Exception("Max disputes")
        if not reason.strip():
            raise Exception("Need reason")
        market.dispute_note = reason
        market.dispute_count += u256(1)
        market.status = "DISPUTED"
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
        pos = json.loads(market.positions)
        mine = pos.get(sender, {})
        if not isinstance(mine, dict) or not mine:
            raise Exception("No position")
        win = market.outcome
        stake_win = int(mine.get(win, 0))
        if stake_win <= 0:
            raise Exception("No winning stake")
        total = int(market.total_pool)
        winning_pool = 0
        for addr, p in pos.items():
            if isinstance(p, dict):
                winning_pool += int(p.get(win, 0))
        if winning_pool <= 0:
            return u256(0)
        payout = u256(stake_win * total // winning_pool)
        claims = json.loads(market.claims)
        claims[sender] = {"claimed": True, "stake": stake_win, "payout": int(payout)}
        market.claims = json.dumps(claims)
        self.markets[market_id] = market
        return payout

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
