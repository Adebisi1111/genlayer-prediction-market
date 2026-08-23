// Prove the wallet-connect path works in a REAL browser.
//
// We inject a minimal EIP-1193 provider backed by the test keystore, so the
// page's connect() runs exactly the code a MetaMask user hits. This catches
// the "invalid private key" class of bug that only appears in the browser.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const wallet = Wallet.fromEncryptedJsonSync(
  readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8'),
  process.env.GLPASS
);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// Inject a fake injected-wallet BEFORE any page script runs.
await page.addInitScript(({ addr }) => {
  const RPC = 'https://rpc-bradbury.genlayer.com';
  let id = 1;
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [addr];
      if (method === 'eth_chainId') return '0x107d';
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      // Everything else proxies to the real Bradbury RPC.
      const res = await fetch(RPC, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params: params || [] }),
      });
      const j = await res.json();
      if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
      return j.result;
    },
    on: () => {}, removeListener: () => {},
  };
}, { addr: wallet.address });

console.log('=== stake.html connect flow ===');
await page.goto(`${BASE}/stake.html?id=market-2`, { waitUntil: 'load' });
await page.waitForFunction(
  () => !/Loading from chain/.test(document.getElementById('q').textContent),
  { timeout: 90000 }
);
console.log('market loaded :', (await page.locator('#q').textContent()).slice(0, 50));

await page.click('#connectBtn');
// The connect button HIDES on success, so watch the balance field (the real
// signal that connect() resolved) rather than the button's text.
await page.waitForFunction(
  () => {
    const b = document.getElementById('balance');
    const btn = document.getElementById('connectBtn');
    const connected = b && /GEN/.test(b.textContent);
    const failed = btn && /failed|error/i.test(btn.textContent);
    return connected || failed;
  },
  { timeout: 60000 }
);

const btnHidden = await page.locator('#connectBtn').evaluate(
  (el) => el.style.display === 'none' || !el.offsetParent
).catch(() => false);
console.log('connect btn hidden after connect:', btnHidden);

const btnText = (await page.locator('#connectBtn').textContent()).trim();
const balText = (await page.locator('#balance').textContent()).trim();
const stakeBtn = (await page.locator('#stakeBtn').textContent()).trim();
const txResult = (await page.locator('#txResult').textContent()).trim();

console.log('connect button:', btnText);
console.log('balance shown :', balText);
console.log('stake button  :', stakeBtn);
if (txResult) console.log('error banner  :', txResult.slice(0, 140));

// Success signal = balance populated (the connect button is hidden on success,
// so its text is NOT a valid indicator — it stays on "Connecting…").
const connected = /GEN/.test(balText) && btnHidden;
console.log(connected ? '✅ CONNECT SUCCEEDED' : '❌ CONNECT FAILED');

// With a wallet attached the stake button should become actionable.
await page.fill('#amt', '0.1');
await page.waitForTimeout(500);
console.log('after typing  :', (await page.locator('#stakeBtn').textContent()).trim());
console.log('btn disabled  :', await page.locator('#stakeBtn').isDisabled());

console.log('\n=== index.html connect flow ===');
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('.market').length > 0, { timeout: 90000 });
await page.click('#connectBtn');
await page.waitForFunction(
  () => !/Connecting/.test(document.getElementById('connectBtn').textContent),
  { timeout: 60000 }
);
console.log('addr shown    :', (await page.locator('#addr').textContent()).trim());
console.log('balance shown :', (await page.locator('#balance').textContent()).trim());

console.log('\n=== claim.html connect flow ===');
await page.goto(`${BASE}/claim.html`, { waitUntil: 'load' });
await page.click('#connectBtn');
await page.waitForFunction(
  () => !/Connecting/.test(document.getElementById('connectBtn').textContent),
  { timeout: 90000 }
);
await page.waitForFunction(
  () => !/Reading your positions/.test(document.getElementById('marketsList').textContent),
  { timeout: 120000 }
).catch(() => console.log('!! positions still loading after 120s'));
const claimList = (await page.locator('#marketsList').textContent()).replace(/\s+/g, ' ').trim();
console.log('claim button  :', (await page.locator('#connectBtn').textContent()).trim());
console.log('positions     :', claimList.slice(0, 130));
console.log('claimable     :', (await page.locator('#totalClaimable').textContent()).trim());
await page.screenshot({ path: 'shot_claim_connected.png', fullPage: true });

const real = errors.filter(e => !/favicon/i.test(e));
console.log('\nconsole errors:', real.length ? real.slice(0, 6).join('\n  ') : 'none');
await browser.close();
