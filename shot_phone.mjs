import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const wallet = Wallet.fromEncryptedJsonSync(
  readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8'),
  process.env.GLPASS
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

await page.addInitScript(({ addr }) => {
  const RPC = 'https://rpc-bradbury.genlayer.com';
  let id = 1;
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [addr];
      if (method === 'eth_chainId') return '0x107d';
      if (method.startsWith('wallet_')) return null;
      const r = await fetch(RPC, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params: params || [] }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    },
    on: () => {}, removeListener: () => {},
  };
}, { addr: wallet.address });

// market-6 is two-sided so the payout preview shows a real ROI.
await page.goto(`${BASE}/stake.html?id=market-6`, { waitUntil: 'load' });
await page.waitForFunction(
  () => !/Loading from chain/.test(document.getElementById('q').textContent),
  { timeout: 90000 }
);
await page.click('#connectBtn');
await page.waitForFunction(
  () => /GEN/.test(document.getElementById('balance').textContent),
  { timeout: 60000 }
);
await page.fill('#amt', '0.25');
await page.waitForTimeout(600);

// Viewport shot = exactly what fits on the phone without scrolling.
await page.screenshot({ path: 'shot_phone_fold.png' });
console.log('above-fold shot written');
await browser.close();
