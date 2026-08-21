import { readFileSync } from "fs";
import { Wallet } from "ethers";
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

// GenLayer Bradbury Testnet
const RPC_URL = "https://studio.genlayer.com/api";

// Decrypt private key from keystore
const keystorePath = "/home/administrator/.genlayer/keystores/testwallet.json";
const keystore = readFileSync(keystorePath, "utf8");
const password = "genlayer2026";
const wallet = Wallet.fromEncryptedJsonSync(keystore, password);
console.log("Address:", wallet.address);

// GenLayer Bradbury chain config
const genlayerBradbury = defineChain({
  id: 698,
  name: "GenLayer Bradbury Testnet",
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18,
  },
});

// Convert private key to viem format
const account = privateKeyToAccount(wallet.privateKey);
console.log("Viem account address:", account.address);

// Viem clients
export const publicClient = createPublicClient({
  chain: genlayerBradbury,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: genlayerBradbury,
  transport: http(RPC_URL),
});

// Factory contract
const FACTORY = "0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9";

const factoryAbi = parseAbi([
  "function createMarket(string question, string rules, string marketType, string[] options, string source1, string source2, string source3) returns (string)",
  "function getMarketsPage(uint256 page, uint256 limit)",
  "function getConfig() view returns (uint256 marketCount)",
  "function stake(string marketId, string option) payable",
]);

// Create market transaction
async function createMarket() {
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createMarket",
    args: [
      "Will Bitcoin exceed $100,000 by end of 2026?",
      "Outcome is YES if BTC price is above $100,000.",
      "BINARY",
      ["YES", "NO"],
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      "",
      "",
    ],
  });

  const hash = await walletClient.sendTransaction({
    to: FACTORY,
    data: data,
    value: 0n,
  });

  console.log("Transaction hash:", hash);
  return hash;
}

// Run
createMarket()
  .then((hash) => {
    console.log("Success! Tx:", hash);
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error:", e.message || e);
    process.exit(1);
  });
