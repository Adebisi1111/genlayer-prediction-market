// Does toggling YES/NO actually change the displayed payout?
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://adebisi1111.github.io/genlayer-prediction-market';
const MKT = process.env.MKT || 'market-6';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(`${BASE}/stake.html?id=${MKT}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => !/Loading from chain/.test(document.getElementById('q').textContent),
  { timeout: 90000 }
);

console.log('market:', (await page.locator('#q').textContent()).trim().slice(0, 55));
const pool = await page.locator('#poolTotal').textContent().catch(() => '?');
console.log('pool  :', pool.trim());

await page.fill('#amt', '0.1');
await page.waitForTimeout(400);

async function snap(label) {
  const ids = ['winAmt', 'winPct', 'loseAmt', 'dPayout', 'dProfit', 'dRoi', 'barPayout', 'barSide'];
  const out = {};
  for (const id of ids) {
    out[id] = await page.locator('#' + id).textContent().then((t) => t.trim()).catch(() => '—');
  }
  console.log(`\n--- ${label} ---`);
  for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(10)} ${v}`);
  return out;
}

// Default is YES.
const yes = await snap('YES selected');

await page.click('#optNo');
await page.waitForTimeout(500);
const no = await snap('NO selected');

console.log('\n=== VERDICT ===');
const keys = Object.keys(yes);
const same = keys.filter((k) => yes[k] === no[k] && yes[k] !== '—');
const diff = keys.filter((k) => yes[k] !== no[k]);
console.log('changed :', diff.length ? diff.join(', ') : 'NOTHING');
console.log('identical:', same.length ? same.join(', ') : 'none');
console.log(diff.length === 0 ? '❌ BUG: YES and NO show identical payouts' : '✅ payouts differ by side');

// Also confirm the selected class actually moved.
console.log('optNo selected class:', await page.locator('#optNo').evaluate((e) => e.className));
console.log('optYes selected class:', await page.locator('#optYes').evaluate((e) => e.className));
console.log('errors  :', errs.length ? errs.slice(0, 3) : 'none');

await browser.close();
