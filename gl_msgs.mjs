import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const client = createClient({ chain: testnetBradbury });
const tx = await client.getTransaction({ hash: process.argv[2] });

const J = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x), 2);

console.log('exec     :', tx.txExecutionResultName);
console.log('messages :', J(tx.messages ?? []).slice(0, 1200));
const r = tx.txExecutionResult;
if (r) {
  console.log('resultKeys:', Object.keys(r).join(', ').slice(0, 300));
  for (const k of ['pending_transactions', 'messages', 'result']) {
    if (r[k]) console.log(k, '=>', J(r[k]).slice(0, 600));
  }
}
