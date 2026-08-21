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


class Factory(gl.Contract):
    market_count: u256
    markets: TreeMap[str, Market]

    def __init__(self):
        pass

    @gl.public.write
    def create(self, question: str) -> str:
        sender = gl.message.sender_address.as_hex
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.markets[mid] = Market(
            market_id=mid, creator=sender, question=question,
        )
        return mid

    @gl.public.view
    def get(self, market_id: str) -> str:
        m = self.markets.get(market_id, None)
        if m is None:
            return json.dumps({"exists": False})
        return json.dumps({"exists": True, "question": m.question})
