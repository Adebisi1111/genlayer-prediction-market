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

const MARKETS = [
  'Will Ethereum exceed $5,000 by end of 2026?',
  'Will Manchester City win the 2026 Premier League?',
  'Will the US Federal Reserve cut rates in Q1 2026?',
  'Will Apple release a foldable iPhone by end of 2026?',
  'Will Nigeria qualify for the 2026 FIFA World Cup knockout stage?',
];

// marketId -> [option, GEN amount]
const SEED_STAKES = [
  ['market-2', 'YES', '0.5'],
  ['market-3', 'NO', '0.4'],
  ['market-4', 'YES', '0.3'],
];

async function write(functionName, args, value = 0n) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const hash = await client.writeContract({ address: FACTORY, functionName, args, value });
      const receipt = await client.waitForTransactionReceipt({ hash, retries: 100, interval: 5000 });
      let lr = receipt?.consensus_data?.leader_receipt;
      if (Array.isArray(lr)) lr = lr[0];
      const exec = receipt?.txExecutionResultName ?? lr?.execution_result;
      if (exec === 'FINISHED_WITH_RETURN') {
        console.log(`✅ ${functionName}(${args[0]}) tx=${hash}`);
        return true;
      }
      console.log(`❌ ${functionName}(${args[0]}) -> ${exec}`);
      return false;
    } catch (e) {
      console.log(`   retry ${attempt} (${String(e.message).slice(0, 80)})`);
      await sleep(20000 * attempt);
    }
  }
  return false;
}

for (const q of MARKETS) {
  await write('createMarket', [q]);
  await sleep(15000);
}

const count = await client.readContract({ address: FACTORY, functionName: 'getConfig', args: [] });
console.log(`\nmarket_count = ${count}`);

for (const [mid, side, gen] of SEED_STAKES) {
  const wei = BigInt(Math.round(parseFloat(gen) * 1e18));
  await write('stake', [mid, side], wei);
  await sleep(15000);
}

console.log('\nFinal state:');
for (let i = 1; i <= Number(count); i++) {
  const m = await client.readContract({ address: FACTORY, functionName: 'getMarket', args: [`market-${i}`] });
  console.log(`  market-${i}: ${m}`);
}
