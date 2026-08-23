// Headless browser test: does the real page load real chain data?
// This is the only way to prove the frontend fix works end-to-end, since the
// bug was specifically that the browser code path never reached the contract.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

console.log('=== index.html ===');
await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });

// Wait for the on-chain read to populate the market cards.
try {
  await page.waitForFunction(
    () => document.querySelectorAll('.market').length > 0,
    { timeout: 90000 }
  );
} catch {
  console.log('!! markets never rendered');
  console.log('   list HTML:', (await page.locator('#marketsList').innerHTML()).slice(0, 300));
}

const cards = await page.locator('.market').count();
console.log('market cards rendered :', cards);
console.log('totalMarkets stat     :', await page.locator('#totalMarkets').textContent());
console.log('totalVolume stat      :', await page.locator('#totalVolume').textContent());
console.log('activeMarkets stat    :', await page.locator('#activeMarkets').textContent());

if (cards > 0) {
  const first = page.locator('.market').first();
  console.log('first card question   :', (await first.locator('.market-question').textContent()).slice(0, 60));
  console.log('first card pool       :', await first.locator('.market-pool').textContent());
  console.log('first card odds       :', (await first.locator('.odds-value').allTextContents()).join(' / '));
}
await page.screenshot({ path: 'shot_index.png', fullPage: true });

console.log('\n=== stake.html?id=market-2 ===');
await page.goto('http://127.0.0.1:8099/stake.html?id=market-2', { waitUntil: 'load' });
try {
  await page.waitForFunction(
    () => !/Loading from chain/.test(document.getElementById('q').textContent),
    { timeout: 90000 }
  );
} catch { console.log('!! question never loaded'); }

console.log('question   :', await page.locator('#q').textContent());
console.log('status     :', await page.locator('#statusBadge').textContent());
console.log('pool       :', await page.locator('#poolVal').textContent());
console.log('yes price  :', await page.locator('#yesPrice').textContent());
console.log('no price   :', await page.locator('#noPrice').textContent());
console.log('yes staked :', await page.locator('#yesPool').textContent());

// Payout preview must react to typed input, computed off real pools.
await page.fill('#amt', '1.5');
await page.waitForTimeout(400);
console.log('--- typed 1.5 GEN ---');
console.log('if win     :', await page.locator('#winAmt').textContent());
console.log('roi        :', await page.locator('#dRoi').textContent());
console.log('pool after :', await page.locator('#dPool').textContent());
console.log('stake btn  :', await page.locator('#stakeBtn').textContent());
await page.screenshot({ path: 'shot_stake.png', fullPage: true });

console.log('\n=== claim.html ===');
await page.goto('http://127.0.0.1:8099/claim.html', { waitUntil: 'load' });
await page.waitForTimeout(2500);
console.log('list state :', (await page.locator('#marketsList').textContent()).trim().slice(0, 80));
console.log('connect btn:', await page.locator('#connectBtn').textContent());
await page.screenshot({ path: 'shot_claim.png', fullPage: true });

console.log('\n=== console errors ===');
const real = errors.filter(e => !/favicon/i.test(e));
console.log(real.length ? real.slice(0, 8).join('\n') : 'none');

await browser.close();
