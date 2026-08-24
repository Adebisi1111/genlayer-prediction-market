import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026');

const account = createAccount(wallet.privateKey);

let requestId = 0;
const customFetch = async (url, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.jsonrpc === '2.0') {
        if (typeof body.id === 'string') {
          body.id = parseInt(body.id, 10) || 1;
        } else if (typeof body.id !== 'number') {
          body.id = ++requestId;
        }
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
  }
  return fetch(url, init);
};

const client = createClient({ chain: testnetBradbury, account, fetch: customFetch });

console.log('Creating...');
const hash = await client.writeContract({ address: FACTORY, functionName: 'createMarket', args: ['test'], value: '0' });
console.log('Hash:', hash);

const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
let lr = receipt?.consensus_data?.leader_receipt;
if (Array.isArray(lr)) lr = lr[0];
console.log('Exec:', receipt?.txExecutionResultName ?? lr?.execution_result);
