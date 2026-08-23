// Find recent txs sent to a contract and report status + emitted messages.
// Used to locate the claim tx and prove whether a transfer was emitted.
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const RPC = 'https://rpc-bradbury.genlayer.com';
const client = createClient({ chain: testnetBradbury });
const ADDR = process.argv[2];

const r = await fetch(RPC, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'gen_getTransactionsForAddress',
    params: [ADDR, 'latest'],
  }),
});
const j = await r.json();
if (j.error) { console.log('rpc error:', j.error.message); process.exit(1); }

const txs = (j.result || []).slice(-8);
console.log(`last ${txs.length} txs for ${ADDR}:\n`);
for (const t of txs) {
  const cd = String(t.txCalldata ?? '');
  // Method name appears as readable ASCII in the calldata.
  const method = (cd.match(/[a-zA-Z]{4,}/g) || []).slice(-3).join(',');
  console.log(`${t.txId ?? t.hash}`);
  console.log(`  status=${t.statusName} exec=${t.txExecutionResultName}`);
  const msgs = t.messages ?? [];
  if (msgs.length) {
    for (const m of msgs) {
      console.log(`  → TRANSFER to ${m.recipient} value=${String(m.value)} onAcceptance=${m.onAcceptance}`);
    }
  }
}
