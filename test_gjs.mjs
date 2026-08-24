import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = '0x1168b74Cf4C9C42c7c1D7A16ed927774d8974275';
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, 'genlayer2026');

const account = createAccount(wallet.privateKey);

// Custom fetch that fixes JSON-RPC id
const customFetch = async (url, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (body.jsonrpc === '2.0' && typeof body.id === 'string') {
        body.id = parseInt(body.id, 10) || 1;
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
  }
  return fetch(url, init);
};

const client = createClient({ chain: testnetBradbury, account, fetch: customFetch });

try {
  const count = await client.readContract({ address: FACTORY, functionName: 'getConfig', args: [] });
  console.log('getConfig:', count);
} catch (e) {
  console.log('Error:', e.message?.slice(0, 200));
}
