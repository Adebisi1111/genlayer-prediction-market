// Verify the LIVE GitHub Pages site (not localhost) reads real chain data.
import { chromium } from 'playwright';

const BASE = 'https://adebisi1111.github.io/genlayer-prediction-market';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'load' });
try {
  await page.waitForFunction(() => document.querySelectorAll('.market').length > 0, { timeout: 90000 });
} catch { console.log('!! no cards on live site'); }

console.log('LIVE cards   :', await page.locator('.market').count());
console.log('LIVE markets :', await page.locator('#totalMarkets').textContent());
console.log('LIVE volume  :', await page.locator('#totalVolume').textContent());
console.log('LIVE active  :', await page.locator('#activeMarkets').textContent());

await page.goto(BASE + '/stake.html?id=market-6', { waitUntil: 'load' });
try {
  await page.waitForFunction(() => !/Loading from chain/.test(document.getElementById('q').textContent), { timeout: 90000 });
} catch { console.log('!! stake page did not load'); }
console.log('LIVE stake q :', await page.locator('#q').textContent());
console.log('LIVE pool    :', await page.locator('#poolVal').textContent());
console.log('LIVE odds    :', await page.locator('#yesPrice').textContent(), '/', await page.locator('#noPrice').textContent());
await page.screenshot({ path: 'shot_live_stake.png', fullPage: true });

const real = errors.filter(e => !/favicon/i.test(e));
console.log('errors       :', real.length ? real.slice(0, 5).join(' | ') : 'none');
await browser.close();
