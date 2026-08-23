import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = process.env.FACTORY;
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, process.env.GLPASS);
const client = createClient({ chain: testnetBradbury, account: createAccount(wallet.privateKey) });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Bradbury reverts bursts at the consensus contract. Retry with backoff.
async function stakeRetry(id, side, gen, attempts = 4) {
  const value = BigInt(Math.round(gen * 1e18));
  for (let i = 1; i <= attempts; i++) {
    try {
      const hash = await client.writeContract({ address: FACTORY, functionName: 'stake', args: [id, side], value });
      const r = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
      const exec = r?.txExecutionResultName;
      if (exec === 'FINISHED_WITH_RETURN') {
        console.log(`✅ stake(${id}, ${side}, ${gen} GEN)`);
        console.log(`   ${hash}`);
        return true;
      }
      console.log(`⚠️  attempt ${i}: ${exec}`);
    } catch (e) {
      console.log(`⚠️  attempt ${i} reverted: ${String(e.message).slice(0, 90)}`);
    }
    if (i < attempts) { const w = 45000 * i; console.log(`   backing off ${w / 1000}s…`); await sleep(w); }
  }
  console.log(`❌ stake(${id}, ${side}) failed after ${attempts} attempts`);
  return false;
}

await stakeRetry('market-6', 'YES', 0.35);
await sleep(45000);
await stakeRetry('market-6', 'NO', 0.20);

console.log('\nFinal board:');
const count = Number(await client.readContract({ address: FACTORY, functionName: 'getConfig', args: [] }));
let vol = 0;
for (let i = 1; i <= count; i++) {
  const raw = await client.readContract({ address: FACTORY, functionName: 'getMarket', args: [`market-${i}`] });
  const p = String(raw).split('|');
  const pool = Number(BigInt(p[3] || '0')) / 1e18;
  vol += pool;
  console.log(`  market-${i}: ${(p[1] || '').padEnd(8)} ${pool.toFixed(2)} GEN — ${p[0].slice(0, 46)}`);
}
console.log(`\n${count} markets, ${vol.toFixed(2)} GEN total volume`);
