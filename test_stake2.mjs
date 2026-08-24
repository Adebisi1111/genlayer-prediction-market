import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026');

const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

// Test read
const count = await client.readContract({ address: FACTORY, functionName: 'getConfig', args: [] });
console.log('Markets:', count);

// Test write
console.log('Creating...');
const hash = await client.writeContract({ address: FACTORY, functionName: 'createMarket', args: ['test'], value: '0' });
console.log('Hash:', hash);

const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
let lr = receipt?.consensus_data?.leader_receipt;
if (Array.isArray(lr)) lr = lr[0];
console.log('Exec:', receipt?.txExecutionResultName ?? lr?.execution_result);
