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

async function bal() {
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [wallet.address, 'latest'] }),
  });
  const j = await res.json();
  return Number(BigInt(j.result)) / 1e18;
}

async function write(fn, args = [], value = 0n) {
  const hash = await client.writeContract({ address: FACTORY, functionName: fn, args, value });
  const r = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
  let lr = r?.consensus_data?.leader_receipt; if (Array.isArray(lr)) lr = lr[0];
  const exec = r?.txExecutionResultName ?? lr?.execution_result;
  const ok = exec === 'FINISHED_WITH_RETURN';
  console.log(`${ok ? '✅' : '❌'} ${fn}(${JSON.stringify(args)}) -> ${exec}`);
  console.log(`   tx: ${hash}`);
  if (!ok && lr?.stderr) console.log('   stderr:', String(lr.stderr).slice(0, 400));
  return ok;
}
const read = async (fn, args = []) => client.readContract({ address: FACTORY, functionName: fn, args });

console.log(`Factory: ${FACTORY}`);
console.log(`Wallet : ${wallet.address}\n`);

console.log('1) createMarket');
await write('createMarket', ['Will GenLayer mainnet launch in 2026?']);
console.log('   count =', await read('getConfig'));
await sleep(15000);

console.log('\n2) stake 2 GEN on YES');
await write('stake', ['market-1', 'YES'], 2000000000000000000n);
console.log('   market =', await read('getMarket', ['market-1']));
await sleep(15000);

console.log('\n3) previewPayout for YES');
console.log('   preview =', await read('previewPayout', ['market-1', wallet.address, 'YES', '']));
await sleep(5000);

console.log('\n4) resolve YES');
await write('resolve', ['market-1', 'YES']);
await sleep(15000);

console.log('\n5) settle');
await write('settle', ['market-1']);
await sleep(15000);

const before = await bal();
console.log(`\n6) claim  (balance before: ${before.toFixed(4)} GEN)`);
await write('claim', ['market-1']);

console.log('   waiting for finalized transfer...');
await sleep(45000);
const after = await bal();
console.log(`   balance after : ${after.toFixed(4)} GEN`);
console.log(`   delta         : ${(after - before >= 0 ? '+' : '') + (after - before).toFixed(4)} GEN`);

console.log('\n7) double-claim must fail');
await write('claim', ['market-1']);
