import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026');

const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

const raw = await client.readContract({ address: FACTORY, functionName: 'getMarket', args: ['market-1'] });
console.log('Type:', typeof raw);
console.log('Value:', raw);
console.log('Is string:', typeof raw === 'string');
