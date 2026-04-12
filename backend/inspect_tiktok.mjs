import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILES_DIR = '/Users/its/Documents/Codes/Code_labs/profiles';
const userDataDir = path.join(PROFILES_DIR, 'test3');

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
});

const page = await browser.newPage();
await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });

console.log('Waiting 8 seconds for page to load fully...');
await page.waitForTimeout(8000);

console.log('\n=== PAGE URL ===');
console.log(page.url());

console.log('\n=== FRAMES ===');
const frames = page.frames();
console.log(`Total frames: ${frames.length}`);
for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    console.log(`  Frame[${i}]: ${f.url()}`);
    try {
        const inputs = await f.$$('input[type="file"]');
        console.log(`    -> file inputs: ${inputs.length}`);
        for (const inp of inputs) {
            const html = await inp.evaluate(el => el.outerHTML).catch(() => 'err');
            console.log(`    -> INPUT HTML: ${html.substring(0, 300)}`);
            const visible = await inp.isVisible().catch(() => false);
            console.log(`    -> visible: ${visible}`);
        }
    } catch(e) {
        console.log(`    -> error: ${e.message}`);
    }
}

console.log('\n=== IFRAMES in main DOM ===');
const iframeEls = await page.$$('iframe');
console.log(`Total <iframe> elements: ${iframeEls.length}`);
for (let i = 0; i < iframeEls.length; i++) {
    const src = await iframeEls[i].getAttribute('src').catch(() => 'N/A');
    const name = await iframeEls[i].getAttribute('name').catch(() => 'N/A');
    const id = await iframeEls[i].getAttribute('id').catch(() => 'N/A');
    console.log(`  iframe[${i}]: src=${src} | name=${name} | id=${id}`);
}

console.log('\n=== UPLOAD BUTTONS ===');
const result = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button, div[role="button"], label, span, div')];
    const matches = candidates.filter(el => {
        const txt = el.textContent?.trim();
        return txt === 'Select videos' || txt === 'Select video';
    });
    return matches.map(el => ({
        tag: el.tagName,
        className: el.className.substring(0, 100),
        role: el.getAttribute('role'),
        forAttr: el.getAttribute('for'),
        dataTestid: el.getAttribute('data-testid'),
        dataTt: el.getAttribute('data-tt'),
        text: el.textContent?.trim().substring(0, 50),
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className?.substring(0, 100),
    }));
}).catch(e => `error: ${e.message}`);
console.log(JSON.stringify(result, null, 2));

console.log('\n=== CHECK input[type=file] via JS ===');
const jsInputs = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    return inputs.map(el => ({
        outerHTML: el.outerHTML.substring(0, 300),
        id: el.id,
        className: el.className,
        name: el.name,
        accept: el.accept,
        style: el.getAttribute('style'),
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className?.substring(0, 100),
        visible: el.offsetParent !== null,
    }));
}).catch(e => `error: ${e.message}`);
console.log(JSON.stringify(jsInputs, null, 2));

await page.screenshot({ path: '/tmp/tiktok_upload_inspect.png' });
console.log('\nScreenshot saved to /tmp/tiktok_upload_inspect.png');
console.log('\nPress Ctrl+C to close browser and exit...');
// Keep open for 10s then close
await page.waitForTimeout(10000);
await browser.close();
