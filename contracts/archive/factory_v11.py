# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class PredictionMarketFactory(gl.Contract):
    market_count: u256
    markets: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def createMarket(self, question: str) -> str:
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.markets[mid] = question
        return mid

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        result = self.markets.get(market_id, None)
        if result is None:
            return "NOT_FOUND"
        return result

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
