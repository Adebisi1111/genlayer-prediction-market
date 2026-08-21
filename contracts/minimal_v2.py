# { "Depends": "py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0" }

from genlayer import gl

class Counter(gl.Contract):
    count: int
    
    def __init__(self):
        self.count = 0
    
    @gl.public.write
    def increment(self) -> int:
        self.count += 1
        return self.count
    
    @gl.public.view
    def get(self) -> int:
        return self.count
