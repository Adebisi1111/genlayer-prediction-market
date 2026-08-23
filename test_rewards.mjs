// Verify rewards.html renders REAL computed payouts and transfer evidence.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto(`${BASE}/rewards.html`, { waitUntil: 'domcontentloaded' });

await page.waitForFunction(
  () => !/Reading settled markets/.test(document.getElementById('list').textContent),
  { timeout: 120000 }
).catch(() => console.log('!! still loading'));

console.log('escrow  :', await page.locator('#escrow').textContent());
console.log('totalPay:', await page.locator('#totalPay').textContent());

const cards = await page.locator('.mkt').count();
console.log('settled markets shown:', cards);

for (let i = 0; i < Math.min(cards, 3); i++) {
  const c = page.locator('.mkt').nth(i);
  const q = (await c.locator('h2').textContent()).trim();
  const won = (await c.locator('.won').first().textContent()).replace(/\s+/g, ' ').trim();
  const rows = await c.locator('tbody tr').count();
  console.log(`\n[${i}] ${q.slice(0, 58)}`);
  console.log(`    ${won}  rows=${rows}`);
  for (let r = 0; r < Math.min(rows, 3); r++) {
    const cells = await c.locator('tbody tr').nth(r).locator('td').allTextContents();
    console.log('    ', cells.map((x) => x.replace(/\s+/g, ' ').trim()).join(' | '));
  }
}

// Wait for the best-effort evidence block.
await page.waitForSelector('.ev', { timeout: 90000 }).catch(() => {});
const ev = await page.locator('.ev').count();
if (ev) {
  console.log('\nEVIDENCE BLOCK:', (await page.locator('.ev').first().textContent()).replace(/\s+/g, ' ').trim());
} else {
  console.log('\n!! no evidence block rendered');
}

// Payout sanity: does any table show a non-zero payout?
const anyPayout = await page.locator('.pay').count();
console.log('non-zero payout cells:', anyPayout);
console.log('negative-zero bug   :', /(-0\b|\+-)/.test(await page.locator('#list').textContent()));
console.log('console errors      :', errs.length ? errs.slice(0, 3) : 'none');

await page.screenshot({ path: 'shot_rewards.png', fullPage: true });
await browser.close();
