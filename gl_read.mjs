import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = process.env.FACTORY || '0x55512C7a3C44017B1a2b39E23F87431d9569BE6b';
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, process.env.GLPASS);

const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

const method = process.argv[2];
const args = JSON.parse(process.argv[3] || '[]');

const res = await client.readContract({ address: FACTORY, functionName: method, args });
console.log(`${method}(${JSON.stringify(args)}) =>`, res);
