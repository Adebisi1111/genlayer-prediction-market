import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = process.env.FACTORY || '0x55512C7a3C44017B1a2b39E23F87431d9569BE6b';

const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, process.env.GLPASS);

const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

// REQUIRED before any write — loads the consensus contract ABI/address.
await client.initializeConsensusSmartContract();

const method = process.argv[2];
const args = JSON.parse(process.argv[3] || '[]');
const value = BigInt(process.argv[4] || '0');

console.log(`calling ${method}(${JSON.stringify(args)}) value=${value}`);

const hash = await client.writeContract({ address: FACTORY, functionName: method, args, value });
console.log('tx hash:', hash);

const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
let lr = receipt?.consensus_data?.leader_receipt;
if (Array.isArray(lr)) lr = lr[0];
console.log('exec   :', receipt?.txExecutionResultName ?? lr?.execution_result);
if (lr?.result !== undefined) console.log('result :', JSON.stringify(lr.result).slice(0, 300));
if (lr?.stderr) console.log('stderr :', String(lr.stderr).slice(0, 900));
