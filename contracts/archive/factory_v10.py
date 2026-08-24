# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class PredictionMarketFactory(gl.Contract):
    market_count: u256
    market1: str
    market2: str
    market3: str

    @gl.public.write
    def createMarket(self, question: str) -> str:
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        if int(self.market_count) == 1:
            self.market1 = question
        elif int(self.market_count) == 2:
            self.market2 = question
        elif int(self.market_count) == 3:
            self.market3 = question
        return mid

    @gl.public.view
    def getMarket(self, market_id: str) -> str:
        if market_id == "market-1":
            return self.market1
        if market_id == "market-2":
            return self.market2
        if market_id == "market-3":
            return self.market3
        return "NOT_FOUND"

    @gl.public.view
    def getConfig(self) -> str:
        return str(int(self.market_count))
