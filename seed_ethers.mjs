import { createWalletClient, createPublicClient, http, encodeFunctionData, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const RPC_URL = 'https://rpc-bradbury.genlayer.com';

const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026');

const genlayerBradbury = defineChain({
  id: 4221,
  name: 'GenLayer Bradbury Testnet',
  rpcUrls: { default: { http: [RPC_URL] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
});

const account = privateKeyToAccount(wallet.privateKey);

// Custom transport that fixes JSON-RPC id
const customTransport = (url) => {
  return async (req) => {
    const body = JSON.parse(req.body);
    if (typeof body.id === 'string') {
      body.id = parseInt(body.id, 10) || 1;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };
};

const walletClient = createWalletClient({
  account,
  chain: genlayerBradbury,
  transport: http(RPC_URL),
});

const publicClient = createPublicClient({
  chain: genlayerBradbury,
  transport: http(RPC_URL),
});

// Get consensus contract address
const consensusAddr = await publicClient.readContract({
  address: FACTORY,
  abi: [{ name: 'consensus', type: 'function', inputs: [], outputs: [{ type: 'address' }] }],
  functionName: 'consensus',
});
console.log('Consensus:', consensusAddr);

// Create markets
const markets = [
  'Will Bitcoin exceed $100k?',
  'Will Ethereum exceed $5k?',
  'Will Man City win?',
];

for (const q of markets) {
  try {
    const hash = await walletClient.writeContract({
      address: FACTORY,
      abi: [{ name: 'createMarket', type: 'function', inputs: [{ type: 'string' }], outputs: [{ type: 'string' }] }],
      functionName: 'createMarket',
      args: [q],
    });
    console.log(`Created: ${q} -> ${hash}`);
  } catch (e) {
    console.log(`Error: ${q} -> ${e.message?.slice(0, 200)}`);
  }
}
