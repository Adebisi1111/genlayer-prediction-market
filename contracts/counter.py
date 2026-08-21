# { "Depends": "py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0" }

from genlayer import gl

class Counter(gl.Contract):
    count: u256

    def __init__(self):
        self.count = u256(0)

    @gl.public.write
    def increment(self) -> u256:
        self.count += u256(1)
        return self.count

    @gl.public.view
    def get(self) -> u256:
        return self.count
