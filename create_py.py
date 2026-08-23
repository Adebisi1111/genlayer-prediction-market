import json
from eth_account import Account
from genlayer import Client
from genlayer.runners import testnet_bradbury

# Read keystore
with open("/home/administrator/.genlayer/keystores/testwallet.json") as f:
    keystore = json.load(f)

password = "genlayer2026"
private_key = Account.decrypt(keystore, password)
account = Account.from_key(private_key)
print(f"Address: {account.address}")

# Create client
client = Client(
    chain=testnet_bradbury,
    account=account,
)

FACTORY = "0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9"

# Create market
tx = client.write_contract(
    address=FACTORY,
    function_name="createMarket",
    args=[
        "Will Bitcoin exceed $100,000 by end of 2026?",
        "Outcome is YES if BTC price is above $100,000.",
        "BINARY",
        ["YES", "NO"],
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        "",
        ""
    ]
)

print(f"Transaction: {tx}")
