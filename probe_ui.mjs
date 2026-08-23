// Inspect the EXACT post-connect UI state the user sees: payout fields and the
// stake button (presence, visibility, disabled, text) on both an OPEN and a
// SETTLED market.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { Wallet } from 'ethers';

const BASE = process.env.BASE || 'https://adebisi1111.github.io/genlayer-prediction-market';
const wallet = Wallet.fromEncryptedJsonSync(
  readFileSync('/home/administrator/.genlayer/keystores/testwallet.json', 'utf8'),
  process.env.GLPASS
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

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
      if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
      return j.result;
    },
    on: () => {}, removeListener: () => {},
  };
}, { addr: wallet.address });

async function probe(marketId, typeAmount) {
  console.log(`\n########## ${marketId} (typing ${typeAmount}) ##########`);
  await page.goto(`${BASE}/stake.html?id=${marketId}`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => !/Loading from chain/.test(document.getElementById('q').textContent),
    { timeout: 90000 }
  );

  await page.click('#connectBtn');
  // Connected state now HIDES the connect button, so wait for the balance.
  await page.waitForFunction(
    () => /GEN/.test(document.getElementById('balance').textContent),
    { timeout: 60000 }
  );

  await page.fill('#amt', String(typeAmount));
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    const btn = g('stakeBtn');
    const cs = btn ? getComputedStyle(btn) : null;
    const r = btn ? btn.getBoundingClientRect() : null;
    return {
      status: g('statusBadge').textContent.trim(),
      pool: g('poolVal').textContent.trim(),
      yesPrice: g('yesPrice').textContent.trim(),
      noPrice: g('noPrice').textContent.trim(),
      winAmt: g('winAmt').textContent.trim(),
      winPct: g('winPct').textContent.trim(),
      loseAmt: g('loseAmt').textContent.trim(),
      dStake: g('dStake').textContent.trim(),
      dPool: g('dPool').textContent.trim(),
      dProfit: g('dProfit').textContent.trim(),
      dRoi: g('dRoi').textContent.trim(),
      btnExists: !!btn,
      btnText: btn ? btn.textContent.trim() : null,
      btnDisabled: btn ? btn.disabled : null,
      btnDisplay: cs ? cs.display : null,
      btnVisibility: cs ? cs.visibility : null,
      btnOpacity: cs ? cs.opacity : null,
      btnHeight: r ? Math.round(r.height) : null,
      btnInViewport: r ? (r.top < innerHeight && r.bottom > 0) : null,
      btnTopPx: r ? Math.round(r.top) : null,
      barSide: g('barSide') ? g('barSide').textContent.trim() : null,
      barPayout: g('barPayout') ? g('barPayout').textContent.trim() : null,
      pageHeight: document.body.scrollHeight,
    };
  });
  for (const [k, v] of Object.entries(state)) console.log(`  ${k.padEnd(14)}: ${v}`);
  return state;
}

await probe('market-2', 0.1);   // OPEN, one-sided (100¢/0¢)
await probe('market-6', 0.1);   // OPEN, two-sided (78¢/22¢)
await probe('market-1', 0.1);   // SETTLED

console.log('\nconsole errors:', errors.filter(e => !/favicon/i.test(e)).slice(0, 6).join(' | ') || 'none');
await browser.close();
