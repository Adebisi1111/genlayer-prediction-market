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

async function write(functionName, args = [], value = 0n) {
  const hash = await client.writeContract({ address: FACTORY, functionName, args, value });
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
  let lr = receipt?.consensus_data?.leader_receipt;
  if (Array.isArray(lr)) lr = lr[0];
  const exec = receipt?.txExecutionResultName ?? lr?.execution_result;
  const ok = exec === 'FINISHED_WITH_RETURN';
  console.log(`${ok ? '✅' : '❌'} ${functionName}(${JSON.stringify(args)}) value=${value} -> ${exec}`);
  console.log(`   tx: ${hash}`);
  if (!ok && lr?.stderr) console.log('   stderr:', String(lr.stderr).slice(0, 500));
  return { ok, hash };
}

async function read(functionName, args = []) {
  const res = await client.readContract({ address: FACTORY, functionName, args });
  console.log(`   read ${functionName}(${JSON.stringify(args)}) => ${res}`);
  return res;
}

console.log(`Factory: ${FACTORY}\nWallet : ${wallet.address}\n`);

console.log('STEP 1 — create market');
await write('createMarket', ['Will Bitcoin exceed $100,000 by end of 2026?']);
await read('getConfig');
await sleep(20000);

console.log('\nSTEP 2 — stake 1 GEN on YES');
await write('stake', ['market-1', 'YES'], 1000000000000000000n);
await read('getMarket', ['market-1']);
await sleep(20000);

console.log('\nSTEP 3 — resolve market');
await write('resolve', ['market-1']);
await read('getMarket', ['market-1']);
await sleep(20000);

console.log('\nSTEP 4 — settle market');
await write('settle', ['market-1']);
await read('getMarket', ['market-1']);
await sleep(20000);

console.log('\nSTEP 5 — claim payout');
await write('claim', ['market-1']);

console.log('\n🎉 Full lifecycle complete');
