# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

class PredictionMarketFactory(gl.Contract):
    market_count: u256
    markets: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def createMarket(self, question: str, rules: str, market_type: str, options: list, source1: str, source2: str, source3: str) -> str:
        sender = gl.message.sender_address.as_hex
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        data = json.dumps({"id": mid, "creator": sender, "question": question, "status": "OPEN", "pool": 0, "positions": {}})
        self.markets[mid] = data
        return mid

    @gl.public.write
    def stake(self, market_id: str, option: str) -> None:
        sender = gl.message.sender_address.as_hex
        raw = self.markets.get(market_id, None)
        if raw is None:
            raise Exception("Market not found")
        m = json.loads(raw)
        amt = int(gl.message.value)
        if amt <= 0:
            raise Exception("Must send GEN")
        pos = m.get("positions", {})
        sp = pos.get(sender, {})
        sp[option] = sp.get(option, 0) + amt
        pos[sender] = sp
        m["positions"] = pos
        m["pool"] = m.get("pool", 0) + amt
        self.markets[market_id] = json.dumps(m)

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        raw = self.markets.get(market_id, None)
        if raw is None:
            return json.dumps({"exists": False})
        return raw

    @gl.public.view
    def getConfig(self) -> str:
        return json.dumps({"market_count": int(self.market_count)})
