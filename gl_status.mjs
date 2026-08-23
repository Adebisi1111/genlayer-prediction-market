import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, process.env.GLPASS);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

const r = await client.getTransaction({ hash: process.argv[2] });
const keys = ['status', 'statusName', 'txExecutionResultName', 'result'];
for (const k of keys) if (r?.[k] !== undefined) console.log(k, '=', r[k]);
let lr = r?.consensus_data?.leader_receipt;
if (Array.isArray(lr)) lr = lr[0];
if (lr) {
  console.log('exec_result   =', lr.execution_result);
  if (lr.stderr) console.log('stderr =', String(lr.stderr).slice(0, 1500));
  if (lr.genvm_result) console.log('genvm  =', JSON.stringify(lr.genvm_result).slice(0, 800));
} else {
  console.log('no leader_receipt; top-level keys:', Object.keys(r || {}).join(', '));
  if (r?.consensus_data) console.log('consensus_data keys:', Object.keys(r.consensus_data).join(', '));
}
