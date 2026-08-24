from genlayer import *

class Counter(gl.Contract):
    count: u256
    
    def __init__(self):
        self.count = u256(0)
    
    @gl.public.write
    def increment(self):
        self.count += u256(1)
    
    @gl.public.view
    def get(self) -> u256:
        return self.count
