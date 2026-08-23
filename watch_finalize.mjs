// Watch a tx until it FINALIZES and report whether the emitted transfer paid out.
// GenLayer transfers with onAcceptance=false only move value at FINALIZATION,
// which happens later than ACCEPTED — this proves whether payouts work at all.
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const RPC = 'https://rpc-bradbury.genlayer.com';
const client = createClient({ chain: testnetBradbury });
const HASH = process.argv[2];
const WATCH = process.argv.slice(3);

async function bal(a) {
  const r = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [a, 'latest'] }),
  });
  return Number(BigInt((await r.json()).result)) / 1e18;
}

const start = {};
for (const a of WATCH) start[a] = await bal(a);
console.log('start balances:', Object.entries(start).map(([a, v]) => `${a.slice(0, 8)}=${v}`).join(' '));

const deadline = Date.now() + 15 * 60 * 1000;
let last = '';
while (Date.now() < deadline) {
  const tx = await client.getTransaction({ hash: HASH });
  const s = `${tx.status} ${tx.statusName}`;
  if (s !== last) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`); last = s; }

  if (tx.statusName === 'FINALIZED') {
    await new Promise(r => setTimeout(r, 8000));
    console.log('\n=== FINALIZED — checking balances ===');
    for (const a of WATCH) {
      const now = await bal(a);
      const d = now - start[a];
      console.log(`${a}  ${now}  (${d >= 0 ? '+' : ''}${d.toFixed(6)})`);
    }
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 15000));
}
console.log('timeout: still', last);
for (const a of WATCH) console.log(a, await bal(a));
