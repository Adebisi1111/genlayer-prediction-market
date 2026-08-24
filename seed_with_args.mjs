import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026');

const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

await client.initializeConsensusSmartContract();

const markets = [
  'Will Bitcoin exceed $100k?',
  'Will Ethereum exceed $5k?',
  'Will Man City win?',
];

for (const q of markets) {
  try {
    const hash = await client.writeContract({ address: FACTORY, functionName: 'createMarket', args: [q], value: '0' });
    console.log(`Created: ${q} -> ${hash}`);
  } catch (e) {
    console.log(`Error: ${q} -> ${e.message?.slice(0, 200)}`);
  }
}

const count = await client.readContract({ address: FACTORY, functionName: 'getConfig', args: [] });
console.log('Total markets:', count);
