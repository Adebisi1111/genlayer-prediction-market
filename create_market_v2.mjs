// Polyfill window before importing genlayer-js
global.window = {
  ethereum: {
    request: async ({ method, params }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        return ["0x61fd0047595A30A067f1F21F3b28C4AE8A8e3Dc3"];
      }
      if (method === 'eth_getBalance') {
        return '0x0';
      }
      return null;
    },
    on: () => {},
    removeListener: () => {},
  }
};

const { createClient } = await import("genlayer-js");
const { testnetBradbury } = await import("genlayer-js/chains");
const { readFileSync } = await import("fs");
const { Wallet } = await import("ethers");

const keystorePath = "/home/administrator/.genlayer/keystores/testwallet.json";
const keystore = readFileSync(keystorePath, "utf8");
const password = "genlayer2026";

const wallet = Wallet.fromEncryptedJsonSync(keystore, password);
console.log("Address:", wallet.address);

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
