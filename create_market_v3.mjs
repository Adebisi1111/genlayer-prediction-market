import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { Wallet } from "ethers";

// Deep override to bypass all window checks
const mockProvider = {
  request: async ({ method, params }) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      return ["0x61fd0047595A30A067f1F21F3b28C4AE8A8e3Dc3"];
    }
    if (method === 'eth_getBalance') return '0x0';
    return null;
  },
  on: () => {},
  removeListener: () => {},
  send: async () => {},
  sendAsync: async () => {},
};

const mockSnaps = {
  'npm:genlayer': { id: 'npm:genlayer', version: '1.0.0', enabled: true }
};

const mockEthereum = {
  request: async ({ method, params }) => {
    if (method === 'wallet_getSnaps') return mockSnaps;
    if (method === 'wallet_requestSnaps') return mockSnaps;
    if (method === 'wallet_invokeSnap') return { result: 'mock' };
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      return ["0x61fd0047595A30A067f1F21F3b28C4AE8A8e3Dc3"];
    }
    if (method === 'eth_getBalance') return '0x0';
    return null;
  },
  on: () => {},
  removeListener: () => {},
  isMetaMask: true,
  provider: mockProvider,
};

global.window = { ethereum: mockEthereum, addEventListener: () => {} };

const keystorePath = "/home/administrator/.genlayer/keystores/testwallet.json";
const keystore = readFileSync(keystorePath, "utf8");
const password = "genlayer2026";

const wallet = Wallet.fromEncryptedJsonSync(keystore, password);
console.log("Address:", wallet.address);

const client = createClient({ chain: testnetBradbury, account: wallet });
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
