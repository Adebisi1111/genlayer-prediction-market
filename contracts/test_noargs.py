# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class Factory(gl.Contract):
    market_count: u256

    @gl.public.write
    def create(self) -> u256:
        self.market_count += u256(1)
        return self.market_count

    @gl.public.view
    def getCount(self) -> u256:
        return self.market_count
