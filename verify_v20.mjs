// Full lifecycle on v20 proving REAL GEN payout:
// create → stake YES → stake NO → resolve → settle → claim → balance moved.
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = process.env.FACTORY;
const RPC = 'https://rpc-bradbury.genlayer.com';
const wallet = Wallet.fromEncryptedJsonSync(
  readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8'),
  process.env.GLPASS
);
const client = createClient({ chain: testnetBradbury, account: createAccount(wallet.privateKey) });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function bal(a) {
  const r = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [a, 'latest'] }),
  });
  return Number(BigInt((await r.json()).result)) / 1e18;
}

async function write(fn, args, value = 0n, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const hash = await client.writeContract({ address: FACTORY, functionName: fn, args, value });
      const r = await client.waitForTransactionReceipt({ hash, retries: 120, interval: 5000 });
      if (r?.txExecutionResultName === 'FINISHED_WITH_RETURN') {
        console.log(`✅ ${fn}(${args.join(', ')})${value ? ' value=' + value : ''}`);
        console.log(`   ${hash}`);
        return { hash, receipt: r };
      }
      console.log(`⚠️  ${fn} attempt ${i}: ${r?.txExecutionResultName}`);
    } catch (e) {
      console.log(`⚠️  ${fn} attempt ${i}: ${String(e.message).slice(0, 80)}`);
    }
    if (i < tries) await sleep(30000 * i);
  }
  throw new Error(`${fn} failed`);
}

const read = (fn, args = []) => client.readContract({ address: FACTORY, functionName: fn, args });

console.log('Factory:', FACTORY);
console.log('Wallet :', wallet.address, '\n');

const mid = 'market-1';
await write('createMarket', ['Will PrimeX pay real GEN rewards on GenLayer?']);
await sleep(18000);

// Two-sided so the payout is strictly greater than the stake.
await write('stake', [mid, 'YES'], 600000000000000000n);
await sleep(18000);
await write('stake', [mid, 'NO'], 400000000000000000n);
await sleep(18000);

console.log('\nmarket:', String(await read('getMarket', [mid])).slice(0, 200));
const poolBefore = await bal(FACTORY);
console.log('contract balance after stakes:', poolBefore, 'GEN');

await write('resolve', [mid]);          // v20 keeps v15's single-arg resolve (YES)
await sleep(18000);
await write('settle', [mid]);
await sleep(18000);

const walletBefore = await bal(wallet.address);
console.log('\nwallet before claim :', walletBefore);

const { hash } = await write('claim', [mid]);
console.log('\nclaim tx:', hash);

// The transfer is emitted with onAcceptance=false → moves at FINALIZATION.
const tx = await client.getTransaction({ hash });
const msgs = (tx.messages ?? []).map(m => ({
  to: m.recipient, value: String(m.value), onAcceptance: m.onAcceptance,
}));
console.log('emitted transfer messages:', JSON.stringify(msgs));

console.log('\nwaiting for FINALIZATION (transfers settle then)…');
for (let i = 0; i < 60; i++) {
  const t = await client.getTransaction({ hash });
  if (t.statusName === 'FINALIZED') {
    await sleep(10000);
    const wAfter = await bal(wallet.address);
    const cAfter = await bal(FACTORY);
    console.log(`\n=== FINALIZED after ~${i * 15}s ===`);
    console.log(`wallet   : ${walletBefore} -> ${wAfter}  (${(wAfter - walletBefore).toFixed(6)})`);
    console.log(`contract : ${poolBefore} -> ${cAfter}  (${(cAfter - poolBefore).toFixed(6)})`);
    console.log(cAfter < poolBefore ? '\n🎉 REAL GEN LEFT THE CONTRACT — payouts work' : '\n❌ contract balance unchanged');
    process.exit(0);
  }
  if (i % 4 === 0) console.log(`  [${i * 15}s] ${t.statusName}`);
  await sleep(15000);
}
console.log('\n⏳ not finalized within 15min; check later with watch_finalize.mjs');
