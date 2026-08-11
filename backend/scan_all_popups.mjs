/**
 * Script SCAN toàn bộ popup xuất hiện trong upload flow
 * KHÔNG dismiss - chỉ ghi lại để biết hết các loại popup
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, '..', 'profiles');
const PROFILE_NAME = 'user4211610817667';
const userDataDir = path.join(PROFILES_DIR, PROFILE_NAME);
const videoPath = path.join(__dirname, '..', 'dummy_videos', 'dummy_upload.mp4');

console.log('='.repeat(60));
console.log('SCAN ALL POPUPS - không dismiss, chỉ quan sát');
console.log('='.repeat(60));

// Lưu lại các popup đã thấy để không log trùng
const seenPopups = new Set();

async function scanAndLogPopups(page, label) {
    const popups = await page.evaluate(() => {
        const results = [];
        const selectors = [
            'div[role="dialog"]',
            'div.TUXModal:not(.TUXModal-overlay)',
            '.react-joyride__tooltip',
            '[class*="tutorial-tooltip"]',
            '[class*="editor-guide"]',
            '[class*="joyride"]',
            '[class*="DivGuideContainer"]',
            '[class*="GuideContainer"]',
            '[class*="callout"]',
            '[class*="Callout"]',
            '[class*="toast"]',
            '[class*="Toast"]',
            '[class*="snackbar"]',
            '[class*="banner"]',
        ];

        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (rect.width < 10 || rect.height < 10) continue;
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

                const text = (el.innerText || '').trim().substring(0, 150);
                if (!text) continue;

                const btns = [...el.querySelectorAll('button')]
                    .filter(b => b.offsetParent !== null)
                    .map(b => (b.innerText || '').trim())
                    .filter(t => t.length > 0);

                results.push({
                    selector: sel,
                    classes: (el.className || '').substring(0, 120),
                    text: text,
                    buttons: btns,
                    rect: { w: Math.round(rect.width), h: Math.round(rect.height) }
                });
            }
        }
        return results;
    });

    // Lọc và log chỉ popup mới
    const newPopups = [];
    for (const p of popups) {
        const key = p.text.substring(0, 50);
        if (!seenPopups.has(key)) {
            seenPopups.add(key);
            newPopups.push(p);
        }
    }

    if (newPopups.length > 0) {
        console.log(`\n🔔 [${label}] ${newPopups.length} POPUP MỚI:`);
        for (const p of newPopups) {
            console.log(`  ─────────────────────────────────`);
            console.log(`  Selector : ${p.selector}`);
            console.log(`  Classes  : ${p.classes.substring(0, 80)}`);
            console.log(`  Text     : "${p.text}"`);
            console.log(`  Buttons  : [${p.buttons.join(' | ')}]`);
            console.log(`  Size     : ${p.rect.w}x${p.rect.h}`);
        }
    }

    return newPopups;
}

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
});

const page = await browser.newPage();

try {
    console.log('\n[1] Mở trang upload...');
    await page.goto('https://www.tiktok.com/creator-center/upload?lang=en', {
        waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(3000);
    await scanAndLogPopups(page, 'SAU_KHI_VÀO_TRANG');

    console.log('\n[1.5] Kiểm tra và dismiss banner draft cũ...');
    // Banner "A video you were editing wasn't saved"
    try {
        const discardBtn = await page.$('button:has-text("Discard")');
        if (discardBtn && await discardBtn.isVisible()) {
            console.log('⚠️  Thấy banner draft cũ → click Discard');
            await discardBtn.click();
            await page.waitForTimeout(1000);
        }
    } catch (e) {}
    await scanAndLogPopups(page, 'SAU_KHI_DISCARD_DRAFT');

    console.log('\n[2] Upload video...');
    let uploaded = false;

    // Strategy 1: Click "Select video" button → filechooser
    try {
        const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 8000 }),
            page.click('button.upload-stage-btn, button[data-e2e="select_video_button"], button:has-text("Select video")')
        ]);
        await fileChooser.setFiles(videoPath);
        console.log('✅ Strategy 1 (Select video click) success');
        uploaded = true;
    } catch (e) { console.log('Strategy 1 failed:', e.message); }

    // Strategy 2: Expose hidden file input
    if (!uploaded) {
        try {
            await page.evaluate(() => {
                document.querySelectorAll('input[type="file"]').forEach(el => {
                    el.style.display = 'block';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                    el.style.position = 'fixed';
                    el.style.top = '0'; el.style.left = '0';
                    el.style.width = '100px'; el.style.height = '100px';
                    el.style.zIndex = '99999';
                });
            });
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.setInputFiles(videoPath);
                console.log('✅ Strategy 2 (expose hidden input) success');
                uploaded = true;
            }
        } catch (e) { console.log('Strategy 2 failed:', e.message); }
    }

    if (!uploaded) {
        console.log('❌ Không upload được!');
        await browser.close();
        process.exit(1);
    }

    // Scan liên tục mỗi 2s trong 3 phút, KHÔNG dismiss
    console.log('\n[3] Bắt đầu scan popup mỗi 2s trong 3 phút...\n');
    const screenshotTaken = new Set();

    for (let i = 0; i < 90; i++) {
        await page.waitForTimeout(2000);
        const newOnes = await scanAndLogPopups(page, `T+${(i+1)*2}s`);

        // Screenshot khi phát hiện popup mới
        for (const p of newOnes) {
            const fname = `scan_popup_${i}_${p.buttons[0] || 'noBtns'}.png`.replace(/[^a-z0-9_.]/gi, '_');
            if (!screenshotTaken.has(fname)) {
                await page.screenshot({ path: path.join(__dirname, fname) });
                console.log(`  📸 Screenshot: ${fname}`);
                screenshotTaken.add(fname);
            }
        }

        // Kiểm tra Post button để biết upload xong chưa
        const postBtn = await page.$('button[data-e2e="post_video_button"]:not([disabled])');
        if (postBtn && await postBtn.isVisible().catch(() => false)) {
            console.log(`\n✅ [T+${(i+1)*2}s] Post button enabled! Upload hoàn thành.`);
            await page.screenshot({ path: path.join(__dirname, 'scan_upload_done.png') });
            console.log('📸 scan_upload_done.png');
            break;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TỔNG KẾT popup đã thấy:');
    console.log([...seenPopups].map((t, i) => `  ${i+1}. "${t}"`).join('\n'));
    console.log('='.repeat(60));

    console.log('\nGiữ browser 60s để kiểm tra thủ công...');
    await page.waitForTimeout(60000);

} catch (err) {
    console.error('Fatal:', err.message);
    await page.screenshot({ path: path.join(__dirname, 'scan_error.png') }).catch(() => null);
}

await browser.close();
console.log('Done.');
