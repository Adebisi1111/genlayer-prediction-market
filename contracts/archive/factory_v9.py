# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

class PredictionMarketFactory(gl.Contract):
    market_count: u256
    markets: TreeMap[str, str]

    @gl.public.write
    def createMarket(self, question: str) -> str:
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        # Store as simple string instead of JSON
        self.markets[mid] = question
        return mid

    @gl.public.write
    def stake(self, market_id: str) -> None:
        raw = self.markets.get(market_id, None)
        if raw is None:
            raise Exception("Market not found")
        amt = gl.message.value
        if amt <= u256(0):
            raise Exception("Must send GEN")
        self.markets[market_id] = raw + "|staked"

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        raw = self.markets.get(market_id, None)
        if raw is None:
            return "NOT_FOUND"
        return raw

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
