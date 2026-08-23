// Check payout display with NO amount entered, and on settled markets.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://adebisi1111.github.io/genlayer-prediction-market';
const browser = await chromium.launch();

for (const MKT of ['market-6', 'market-1', 'market-7', 'market-5']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/stake.html?id=${MKT}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !/Loading from chain/.test(document.getElementById('q').textContent),
    { timeout: 90000 }
  ).catch(() => {});

  const grab = async () => ({
    win: await page.locator('#winAmt').textContent().then(t => t.trim()).catch(() => '—'),
    pct: await page.locator('#winPct').textContent().then(t => t.trim()).catch(() => '—'),
    bar: await page.locator('#barPayout').textContent().then(t => t.trim()).catch(() => '—'),
  });

  // 1) NO amount typed yet — this is what a user sees on first load.
  const emptyYes = await grab();
  await page.click('#optNo'); await page.waitForTimeout(350);
  const emptyNo = await grab();

  const btn = await page.locator('#stakeBtn').textContent().then(t => t.trim()).catch(() => '—');
  const identicalEmpty = JSON.stringify(emptyYes) === JSON.stringify(emptyNo);

  console.log(`\n=== ${MKT} ===`);
  console.log(`  stakeBtn: ${btn}`);
  console.log(`  EMPTY amount  YES ${JSON.stringify(emptyYes)}`);
  console.log(`  EMPTY amount  NO  ${JSON.stringify(emptyNo)}`);
  console.log(`  identical when empty: ${identicalEmpty ? 'YES <-- both sides look the same' : 'no'}`);

  // 2) With an amount.
  await page.fill('#amt', '0.1'); await page.waitForTimeout(400);
  const withNo = await grab();
  await page.click('#optYes'); await page.waitForTimeout(400);
  const withYes = await grab();
  console.log(`  0.1 typed     YES ${JSON.stringify(withYes)}`);
  console.log(`  0.1 typed     NO  ${JSON.stringify(withNo)}`);
  console.log(`  identical with amount: ${JSON.stringify(withYes) === JSON.stringify(withNo) ? 'YES <-- BUG' : 'no'}`);

  await page.close();
}
await browser.close();
