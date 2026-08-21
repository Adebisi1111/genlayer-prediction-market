import { readFileSync } from "fs";
import { Wallet } from "ethers";
import { createPublicClient, http, parseAbi } from "viem";
import { defineChain } from "viem";

const RPC_URL = "https://studio.genlayer.com/api";

// GenLayer Bradbury chain
const genlayerBradbury = defineChain({
  id: 698,
  name: "GenLayer Bradbury Testnet",
  rpcUrls: { default: { http: [RPC_URL] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
});

const client = createPublicClient({
  chain: genlayerBradbury,
  transport: http(RPC_URL),
});

// Check transaction receipt
const txHash = "0xf401004b8173cb6ef9830f7184d8e7bf39c768e9e1d7267936fe3306235da19f";
const receipt = await client.getTransactionReceipt({ hash: txHash });
console.log("Receipt:", receipt);

// Check market count
const FACTORY = "0xDD457e0F2FfE7B843f8C90f7997DB06714666CC9";
const count = await client.readContract({
  address: FACTORY,
  abi: parseAbi(["function getConfig() view returns (uint256 marketCount)"]),
  functionName: "getConfig",
});
console.log("Market count:", count.toString());

// Check wallet balance
const balance = await client.getBalance({ address: "0x61fd0047595A30A067f1F21F3b28C4AE8A8e3Dc3" });
console.log("Balance:", balance.toString());
