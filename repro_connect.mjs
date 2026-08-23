// Reproduce the user's failure precisely against the LIVE site, capturing the
// full error and stack so we learn WHERE "invalid private key" comes from.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const wallet = Wallet.fromEncryptedJsonSync(
  readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8'),
  process.env.GLPASS
);
const ADDR = wallet.address;
const PK = wallet.privateKey;

const browser = await chromium.launch();
// Fresh context = no cache, like a first-time visitor.
const ctx = await browser.newContext({ bypassCSP: true });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

await page.addInitScript(({ addr, pk }) => {
  const RPC = 'https://rpc-bradbury.genlayer.com';
  let id = 1;
  window.__rpcCalls = [];
  const raw = async (method, params = []) => {
    const r = await fetch(RPC, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }),
    });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
    return j.result;
  };
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      window.__rpcCalls.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [addr];
      if (method === 'eth_chainId') return '0x107d';
      if (method.startsWith('wallet_')) return null;
      // A real wallet SIGNS locally then broadcasts. Emulate that, otherwise
      // the node correctly reports "no signer accounts".
      if (method === 'eth_sendTransaction') {
        const tx = params[0];
        const signed = await window.__signTx(tx);
        return raw('eth_sendRawTransaction', [signed]);
      }
      return raw(method, params || []);
    },
    on: () => {}, removeListener: () => {},
  };
  window.__PK = pk;
}, { addr: ADDR, pk: PK });

// Provide local signing inside the page using ethers from a CDN.
await page.addInitScript(() => {
  window.__signTx = async (tx) => {
    if (!window.__ethersMod) {
      window.__ethersMod = await import('https://esm.sh/ethers@6.13.4');
    }
    const { Wallet, JsonRpcProvider } = window.__ethersMod;
    const provider = new JsonRpcProvider('https://rpc-bradbury.genlayer.com', 4221);
    const w = new Wallet(window.__PK, provider);
    const populated = await w.populateTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : 0n,
      chainId: 4221,
    });
    return w.signTransaction(populated);
  };
});

await page.goto(`${BASE}/stake.html?id=market-2`, { waitUntil: 'load' });
await page.waitForFunction(
  () => !/Loading from chain/.test(document.getElementById('q').textContent),
  { timeout: 90000 }
);

// Capture the real error by calling connect() directly with a full stack.
const connectResult = await page.evaluate(async () => {
  const mod = await import('./gl-client.v2.js?v=2');
  try {
    const addr = await mod.connect();
    return { ok: true, addr };
  } catch (e) {
    return { ok: false, message: e.message, stack: e.stack };
  }
});
console.log('=== connect() direct call ===');
console.log(JSON.stringify(connectResult, null, 2).slice(0, 1500));

// Now the critical part: does an actual WRITE work through the browser wallet?
if (connectResult.ok) {
  console.log('\n=== attempting real stake write (0.05 GEN) ===');
  const w = await page.evaluate(async () => {
    const mod = await import('./gl-client.v2.js?v=2');
    try {
      const r = await mod.stake('market-2', 'YES', '0.05');
      return { ok: true, hash: r.hash, exec: r.exec };
    } catch (e) {
      return { ok: false, message: e.message, stack: (e.stack || '').slice(0, 900) };
    }
  });
  console.log(JSON.stringify(w, null, 2).slice(0, 1800));
}

console.log('\n=== wallet RPC methods requested ===');
console.log((await page.evaluate(() => window.__rpcCalls)).join(', '));

console.log('\n=== console/page logs ===');
console.log(logs.filter(l => !/favicon/i.test(l)).slice(0, 10).join('\n'));

await browser.close();
