# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class Counter(gl.Contract):
    count: u256
    
    @gl.public.write
    def increment(self) -> u256:
        self.count += u256(1)
        return self.count
    
    @gl.public.view
    def get(self) -> u256:
        return self.count


class SimpleFactory(gl.Contract):
    market_count: u256
    last_question: str

    @gl.public.write
    def create(self, question: str) -> str:
        self.market_count += u256(1)
        self.last_question = question
        return f"market-{self.market_count}"

    @gl.public.view
    def getCount(self) -> u256:
        return self.market_count

    @gl.public.view
    def getLastQuestion(self) -> str:
        return self.last_question
