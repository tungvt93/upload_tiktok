import { chromium } from 'playwright';

const extId = 'ijibphmgemkmipkpmfhmjpbegbgjdcpe';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = await browser.newPage();
await page.goto('chrome-extension://' + extId + '/popup/index.html', { waitUntil: 'domcontentloaded', timeout: 10000 });
await page.waitForTimeout(3000);

const html = await page.evaluate(() => document.body.innerHTML.substring(0, 8000));
console.log('=== POPUP HTML ===');
console.log(html);

await page.screenshot({ path: '/tmp/urban-popup.png' });
console.log('=== SCREENSHOT saved to /tmp/urban-popup.png ===');
await browser.close();
