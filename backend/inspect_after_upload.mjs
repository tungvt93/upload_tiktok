import { chromium } from 'playwright';
import path from 'path';

const PROFILES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'profiles');
const userDataDir = path.join(PROFILES_DIR, 'test3');
const avatarImage = '/Users/its/Downloads/23ae2ca55d67413856b923cd3a8288a4~tplv-tiktokx-cropcenter_1080_1080.jpeg';

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
});
const page = await browser.newPage();

await page.goto('https://www.tiktok.com/@user11900787327300', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);

console.log('Clicking Edit profile...');
const editBtn = await page.waitForSelector(':text("Edit profile")', { timeout: 10000 });
await editBtn.click();
await page.waitForTimeout(4000);

console.log('Uploading file...');
const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000, state: 'visible' });
await fileInput.setInputFiles(avatarImage);
console.log('File uploaded, waiting...');
await page.waitForTimeout(5000);

// Check what buttons are visible now
const info = await page.evaluate(() => {
    const all = document.querySelectorAll('button, div[role="button"], span[role="button"]');
    const visible = [...all].filter(b => b.offsetParent !== null).map(b => ({
        tag: b.tagName,
        text: (b.innerText || b.textContent || '').substring(0, 80).trim(),
        classes: (b.className || '').substring(0, 150),
        disabled: b.disabled || false
    }));
    
    // Also look for any element with Apply/Save/Confirm text
    const allEls = document.querySelectorAll('*');
    const actions = [];
    for (const el of allEls) {
        const text = (el.innerText || el.textContent || '').trim();
        if ((text === 'Apply' || text === 'Save' || text === 'Confirm' || text === 'Done' || text === 'Cancel' || text === 'Change photo' || text === 'Upload') 
            && el.children.length === 0 
            && el.offsetParent !== null) {
            actions.push({
                tag: el.tagName,
                text: text,
                classes: (el.className || '').substring(0, 150)
            });
        }
    }
    
    return { visibleButtons: visible.slice(0, 25), actionElements: actions };
});
console.log(JSON.stringify(info, null, 2));

console.log('\nBrowser open 30s...');
await page.waitForTimeout(30000);
await browser.close();
