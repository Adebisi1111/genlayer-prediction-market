import json
import os
from eth_account import Account
from web3 import Web3

# GenLayer Bradbury testnet RPC
RPC_URL = "https://studio.genlayer.com/api"

# Read keystore
keystore_path = os.path.expanduser("~/.hermes/accounts/testwallet.json")
with open(keystore_path) as f:
    keystore = json.load(f)

# Decrypt private key
password = "genlayer2026"
private_key = Account.decrypt(keystore, password)
account = Account.from_key(private_key)

print(f"Address: {account.address}")
print(f"Private key: {private_key.hex()[:20]}...")

# Connect to GenLayer
w3 = Web3(Web3.HTTPProvider(RPC_URL))
print(f"Connected: {w3.is_connected()}")
print(f"Chain ID: {w3.eth.chain_id}")
print(f"Balance: {w3.eth.get_balance(account.address)}")
