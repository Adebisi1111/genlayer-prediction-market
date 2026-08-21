import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { Wallet } from "ethers";

const keystorePath = "/home/administrator/.genlayer/keystores/testwallet.json";
const keystore = readFileSync(keystorePath, "utf8");
const password = "genlayer2026";

const wallet = Wallet.fromEncryptedJsonSync(keystore, password);
console.log("Address:", wallet.address);
console.log("Private key:", wallet.privateKey.slice(0, 20) + "...");

const client = createClient({ chain: testnetBradbury, account: wallet.privateKey });
await client.connect("testnetBradbury");

const FACTORY = "0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9";

const tx = await client.writeContract({
  address: FACTORY,
  functionName: "createMarket",
  args: [
    "Will Bitcoin exceed $100,000 by end of 2026?",
    "Outcome is YES if BTC price is above $100,000.",
    "BINARY",
    ["YES", "NO"],
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "",
    ""
  ]
});

console.log("Transaction:", tx);
