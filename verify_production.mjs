import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const FACTORY = process.env.FACTORY;
const keystore = readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8');
const wallet = Wallet.fromEncryptedJsonSync(keystore, process.env.GLPASS);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const RPC = 'https://rpc-bradbury.genlayer.com';
async function ethBal(addr) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [addr, 'latest'] }) });
  const j = await r.json();
  return Number(BigInt(j.result)) / 1e18;
}

const txs = [];
async function write(fn, args = [], value = 0n) {
  const hash = await client.writeContract({ address: FACTORY, functionName: fn, args, value });
  const r = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
  let lr = r?.consensus_data?.leader_receipt; if (Array.isArray(lr)) lr = lr[0];
  const exec = r?.txExecutionResultName ?? lr?.execution_result;
  const ok = exec === 'FINISHED_WITH_RETURN';
  console.log(`${ok ? '✅' : '❌'} ${fn}(${JSON.stringify(args)}) value=${value} -> ${exec}`);
  console.log(`   ${hash}`);
  txs.push({ fn, hash, exec, ok });
  return ok;
}
const read = (fn, args = []) => client.readContract({ address: FACTORY, functionName: fn, args });

console.log('=== PrimeX production factory — end-to-end verification ===');
console.log('Factory :', FACTORY);
console.log('Wallet  :', wallet.address);
console.log('Contract balance before:', (await ethBal(FACTORY)).toFixed(4), 'GEN\n');

const before = Number(await read('getConfig'));
console.log('markets before:', before);

console.log('\n[1] createMarket');
await write('createMarket', ['Will PrimeX be accepted by GenLayer stewards?']);
const after = Number(await read('getConfig'));
const mid = `market-${after}`;
console.log('   markets after :', after, '-> new id:', mid);
await sleep(15000);

console.log('\n[2] stake 0.6 GEN on YES');
await write('stake', [mid, 'YES'], 600000000000000000n);
console.log('   ', await read('getMarket', [mid]));
await sleep(15000);

console.log('\n[3] stake 0.3 GEN on NO (second position, tests separator)');
await write('stake', [mid, 'NO'], 300000000000000000n);
console.log('   ', await read('getMarket', [mid]));
await sleep(15000);

console.log('\n[4] resolve (v15 -> YES)');
await write('resolve', [mid]);
console.log('   ', await read('getMarket', [mid]));
await sleep(15000);

console.log('\n[5] settle');
await write('settle', [mid]);
console.log('   ', await read('getMarket', [mid]));
await sleep(15000);

console.log('\n[6] claim');
await write('claim', [mid]);

console.log('\nContract balance after :', (await ethBal(FACTORY)).toFixed(4), 'GEN');

console.log('\n=== SUMMARY ===');
for (const t of txs) console.log(`${t.ok ? 'PASS' : 'FAIL'}  ${t.fn.padEnd(14)} ${t.hash}`);
console.log(`\n${txs.filter(t => t.ok).length}/${txs.length} transactions finished cleanly`);
