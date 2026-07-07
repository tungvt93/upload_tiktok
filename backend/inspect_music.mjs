import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, '..', 'profiles');
const DUMMY_VIDEOS_DIR = path.join(__dirname, '..', 'dummy_videos');

const searchTerm = "Moonlight on Jade Waters Rashad Daugherty";
const userDataDir = path.join(PROFILES_DIR, 'test3');

const dummyFiles = fs.readdirSync(DUMMY_VIDEOS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
});
const videoPath = path.join(DUMMY_VIDEOS_DIR, dummyFiles[0]);

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
});

const page = await browser.newPage();

console.log('1. Navigating to upload page...');
await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

console.log('2. Uploading dummy video...');
const uploadBtn = await page.waitForSelector('button.upload-stage-btn', { timeout: 10000 }).catch(() => null);
if (uploadBtn) {
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 20000 }),
        uploadBtn.click()
    ]);
    await fileChooser.setFiles(videoPath);
    console.log('Video uploaded via upload button');
} else {
    await page.evaluate(() => {
        const input = document.querySelector('input[type="file"]');
        if (input) {
            input.style.display = 'block'; input.style.visibility = 'visible';
            input.style.opacity = '1'; input.style.position = 'fixed';
            input.style.top = '0'; input.style.left = '0'; input.style.zIndex = '99999';
        }
    });
    await page.waitForTimeout(500);
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        page.click('input[type="file"]')
    ]);
    await fileChooser.setFiles(videoPath);
    console.log('Video uploaded via Strategy 2');
}

console.log('3. Waiting for upload UI...');
await page.waitForSelector('button[data-button-name="sounds"], button:has-text("Post"), button:has-text("Cancel")', { timeout: 120000 });
console.log('Upload UI detected. Waiting for upload to complete...');

// Wait for upload to complete (Cancel button detaches)
const cancelBtn = page.locator('button:has-text("Cancel")');
await cancelBtn.waitFor({ state: 'detached', timeout: 20 * 60 * 1000 });
console.log('Upload complete (Cancel gone). Waiting for processing...');
await page.waitForTimeout(5000);

console.log('4. Waiting for Sounds button to become enabled (processing complete)...');
const soundsBtn = await page.waitForSelector('button[data-button-name="sounds"]:not([disabled])', { timeout: 300000, state: 'visible' });
console.log('Video processing complete — sounds button enabled. Clicking...');
await soundsBtn.click();
await page.waitForTimeout(3000);

console.log('5. Searching...');
const searchInput = await page.waitForSelector('input.TextInput__input', { timeout: 10000 });
await searchInput.fill(searchTerm);
await page.waitForTimeout(2000);
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);

// Dump the HTML of the first search result before hover
console.log('\n=== HTML STRUCTURE OF FIRST SEARCH RESULT ===');
const html = await page.evaluate(() => {
    // Find first plus-bold in results (not sidebar)
    const allPlus = document.querySelectorAll('[data-icon="plus-bold"]');
    for (const el of allPlus) {
        if (el.closest('[class*="Sidebar"]') || el.closest('[class*="sidebar"]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.y < 150) continue;

        // Walk up several levels to find the music item
        let node = el;
        for (let i = 0; i < 8; i++) {
            node = node.parentElement;
            if (!node) break;
        }
        // Dump the top-level container HTML
        const container = el.closest('[class*="Result"]') ||
                         el.closest('[class*="Item"]') ||
                         el.closest('[class*="sound"]') ||
                         el.closest('[class*="music"]') ||
                         el.parentElement?.closest('div[class*="row"]') ||
                         el.parentElement?.closest('div[class*="list"]')?.firstElementChild;
        if (container) {
            return container.outerHTML.substring(0, 3000);
        }
        // Fallback: dump parent chain
        let chain = el.parentElement;
        for (let i = 0; i < 5; i++) {
            if (chain && chain.parentElement) chain = chain.parentElement;
        }
        return chain ? chain.outerHTML.substring(0, 3000) : 'no chain';
    }
    return 'none found';
});
console.log(html);

// Now hover over the first music result
console.log('\n=== HOVERING FIRST RESULT ===');
const hovered = await page.evaluate(() => {
    const allPlus = document.querySelectorAll('[data-icon="plus-bold"]');
    for (const el of allPlus) {
        if (el.closest('[class*="Sidebar"]') || el.closest('[class*="sidebar"]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.y < 150) continue;
        // Find container and trigger hover
        const container = el.closest('[class*="Result"]') ||
                         el.closest('[class*="Item"]') ||
                         el.closest('[class*="sound"]') ||
                         el.closest('[class*="music"]') ||
                         el.parentElement?.parentElement?.parentElement;
        if (container) {
            container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
            container.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
            return 'hover_dispatched';
        }
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        return 'hover_on_icon';
    }
    return 'none';
});
console.log('JS hover result:', hovered);
await page.waitForTimeout(500);

// Take screenshot
await page.screenshot({ path: path.join(__dirname, 'debug_after_hover.png') });
console.log('Screenshot saved: debug_after_hover.png');

// Dump ALL buttons that are visible in the page
console.log('\n=== ALL VISIBLE BUTTONS (y > 150, not sidebar) ===');
const btns = await page.evaluate(() => {
    const all = document.querySelectorAll('button');
    const results = [];
    for (const btn of all) {
        if (btn.closest('[class*="Sidebar"]') || btn.closest('[class*="sidebar"]')) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 || rect.y < 150) continue;
        const text = (btn.textContent || '').trim().substring(0, 50);
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const dataIcons = Array.from(btn.querySelectorAll('[data-icon]')).map(i => i.getAttribute('data-icon'));
        const cls = (typeof btn.className === 'string' ? btn.className : btn.className?.baseVal || '').substring(0, 60);
        results.push({ text, ariaLabel, dataIcons, cls, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) });
    }
    return results;
});
for (const b of btns) {
    console.log(`  btn text="${b.text}" aria="${b.ariaLabel}" icons=[${b.dataIcons.join(',')}] cls="${b.cls}" pos=(${b.x},${b.y}) ${b.w}x${b.h}`);
}

// Also dump ALL elements (not just buttons) with specific class patterns near search results
console.log('\n=== ELEMENTS WITH ROLE/LISTITEM NEAR RESULTS ===');
const items = await page.evaluate(() => {
    const results = [];
    const all = document.querySelectorAll('div[role="listitem"], [class*="MusicResult"], [class*="SoundItem"], [class*="sound-item"], [class*="music-item"], div[class*="Result"]');
    for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.y < 150) continue;
        const text = (el.textContent || '').trim().substring(0, 80);
        const cls = (typeof el.className === 'string' ? el.className : el.className?.baseVal || '').substring(0, 80);
        results.push({ text, cls, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) });
    }
    return results;
});
for (const item of items) {
    console.log(`  item text="${item.text}" cls="${item.cls}" pos=(${item.x},${item.y}) ${item.w}x${item.h}`);
}

console.log('\n=== DONE. Browser stays open for inspection. ===');
