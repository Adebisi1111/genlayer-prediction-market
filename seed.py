from genlayer import *
from dataclasses import dataclass
from genlayer import gl
import json

# Create client
client = createClient(chain=testnetBradbury)
client.connect('testnetBradbury')

# Test call
result = client.readContract(
    address='0x6c2321c516f1793b5365Eb69d8257D6FbC885a7f',
    functionName='getConfig',
    args=[]
)
print(f"Config: {result}")
