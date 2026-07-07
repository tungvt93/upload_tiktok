import { chromium } from 'playwright';
import path from 'path';

const PROFILES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'profiles');
const userDataDir = path.join(PROFILES_DIR, 'test3');

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
});
const page = await browser.newPage();

await page.goto('https://www.tiktok.com/@user11900787327300', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);

console.log('Clicking Edit profile...');
const editBtn = await page.$(':text("Edit profile")');
await editBtn.click();
await page.waitForTimeout(4000);

// Deep inspection of modal/dialog
const info = await page.evaluate(() => {
    // All inputs
    const inputs = document.querySelectorAll('input');
    const inputInfo = [...inputs].map(i => ({
        type: i.type || 'text',
        visible: i.offsetParent !== null,
        classes: (i.className || '').substring(0, 150),
        accept: i.accept || ''
    }));
    
    // Look inside all potential modal containers
    const containers = document.querySelectorAll('[role="dialog"], [role="modal"], div[class*="modal" i], div[class*="drawer" i], div[class*="panel" i], div[class*="popup" i], div[class*="portal" i], div[class*="overlay" i]');
    const containerInfo = [...containers].slice(0, 5).map(c => ({
        classes: (c.className || '').substring(0, 200),
        innerText: (c.innerText || '').substring(0, 300)
    }));
    
    // ALL elements with "Apply", "Save", "Confirm" text
    const all = document.querySelectorAll('*');
    const actions = [];
    for (const el of all) {
        const text = (el.innerText || el.textContent || '').trim();
        if ((text === 'Apply' || text === 'Save' || text === 'Confirm' || text === 'Done' || text === 'Cancel' || text === 'Change photo' || text === 'Upload photo') 
            && el.children.length === 0 
            && el.offsetParent !== null) {
            actions.push({
                tag: el.tagName,
                text: text,
                classes: (el.className || '').substring(0, 150),
                role: el.getAttribute('role') || ''
            });
        }
    }
    
    return { inputs: inputInfo, containers: containerInfo, actions };
});
console.log(JSON.stringify(info, null, 2));

console.log('\nBrowser open 30s...');
await page.waitForTimeout(30000);
await browser.close();
