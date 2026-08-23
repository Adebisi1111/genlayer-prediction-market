import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, process.env.GLPASS);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

const code = readFileSync(process.argv[2], 'utf8');

const hash = await client.deployContract({ code, args: [], value: 0n });
console.log('deploy tx:', hash);

const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
console.log('status   :', receipt?.status ?? receipt?.txExecutionResultName);
const tx = await client.getTransaction({ hash });
console.log('ADDRESS  :', tx?.recipient);
