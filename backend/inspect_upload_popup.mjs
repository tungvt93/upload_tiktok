/**
 * Script kiểm tra popup xuất hiện trong quá trình upload TikTok
 * Profile: user4211610817667
 * Video: dummy_videos/dummy_upload.mp4 (không public)
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
console.log('INSPECT UPLOAD POPUP SCRIPT');
console.log('Profile:', PROFILE_NAME);
console.log('Video:', videoPath);
console.log('='.repeat(60));

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized'
    ]
});

const page = await browser.newPage();

// Hàm quét tất cả modal/popup đang hiển thị
async function scanPopups(label = '') {
    const result = await page.evaluate(() => {
        const found = [];
        const dialogSelectors = [
            'div[role="dialog"]',
            'div[class*="modal"]',
            'div[class*="Modal"]',
            'div[class*="portal"]',
            'div[class*="dialog"]',
            'div[class*="Dialog"]',
            'div[class*="popup"]',
            'div[class*="Popup"]',
            'div[class*="overlay"]',
            'div[class*="Overlay"]',
            'div[class*="confirm"]',
            'div[class*="Confirm"]',
        ];

        for (const sel of dialogSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                if (el.offsetParent !== null || window.getComputedStyle(el).display !== 'none') {
                    const text = (el.innerText || '').substring(0, 300).trim();
                    if (!text) continue;
                    const buttons = [...el.querySelectorAll('button')].map(b => ({
                        text: (b.innerText || '').trim(),
                        disabled: b.disabled,
                        classes: (b.className || '').substring(0, 100)
                    })).filter(b => b.text);

                    found.push({
                        selector: sel,
                        text: text.substring(0, 200),
                        buttons: buttons,
                        classes: (el.className || '').substring(0, 150),
                        role: el.getAttribute('role') || ''
                    });
                }
            }
        }
        return found;
    });

    if (result.length > 0) {
        console.log(`\n⚠️  [${label}] POPUPS DETECTED (${result.length}):`);
        for (const popup of result) {
            console.log(`  Selector: ${popup.selector}`);
            console.log(`  Classes: ${popup.classes}`);
            console.log(`  Text: "${popup.text}"`);
            console.log(`  Buttons: ${JSON.stringify(popup.buttons)}`);
            console.log('  ---');
        }
    } else {
        console.log(`  [${label}] No popups detected.`);
    }
    return result;
}

// Hàm quét tất cả buttons hiển thị trên trang
async function scanAllButtons(label = '') {
    const buttons = await page.evaluate(() => {
        const all = [...document.querySelectorAll('button')];
        return all
            .filter(b => b.offsetParent !== null)
            .map(b => ({
                text: (b.innerText || b.textContent || '').trim().substring(0, 80),
                disabled: b.disabled,
                classes: (b.className || '').substring(0, 120),
                dataAttr: b.getAttribute('data-e2e') || b.getAttribute('data-button-name') || ''
            }))
            .filter(b => b.text.length > 0);
    });

    console.log(`\n📋 [${label}] ALL VISIBLE BUTTONS (${buttons.length}):`);
    for (const btn of buttons) {
        const status = btn.disabled ? '🔴 DISABLED' : '🟢 ENABLED';
        console.log(`  ${status} "${btn.text}" | data=${btn.dataAttr} | cls=${btn.classes.substring(0, 60)}`);
    }
    return buttons;
}

try {
    // 1. Đi đến trang upload TikTok
    console.log('\n[1] Navigating to TikTok upload page...');
    await page.goto('https://www.tiktok.com/creator-center/upload?lang=en', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Quét popup ngay sau khi vào trang
    await scanPopups('INITIAL_PAGE_LOAD');
    await scanAllButtons('INITIAL_BUTTONS');

    // 2. Tìm và click nút upload / kéo thả video
    console.log('\n[2] Looking for file input or upload button...');
    
    let uploaded = false;

    // Strategy 1: Direct file input
    try {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(videoPath);
            console.log('✅ Strategy 1 (direct file input) success');
            uploaded = true;
        }
    } catch (e) {
        console.log('Strategy 1 failed:', e.message);
    }

    // Strategy 2: Click "Select video" button then file chooser
    if (!uploaded) {
        try {
            const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 8000 }),
                page.click('button:has-text("Select video"), .upload-btn, [class*="upload"] button, button:has-text("Upload")')
            ]);
            await fileChooser.setFiles(videoPath);
            console.log('✅ Strategy 2 (Select video button) success');
            uploaded = true;
        } catch (e) {
            console.log('Strategy 2 failed:', e.message);
        }
    }

    // Strategy 3: Find hidden file input and set files directly (bypass click)
    if (!uploaded) {
        try {
            // Expose hidden file input
            await page.evaluate(() => {
                const inputs = document.querySelectorAll('input[type="file"]');
                for (const input of inputs) {
                    input.style.display = 'block';
                    input.style.visibility = 'visible';
                    input.style.opacity = '1';
                    input.style.width = '100px';
                    input.style.height = '100px';
                }
            });
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.setInputFiles(videoPath);
                console.log('✅ Strategy 3 (hidden input reveal) success');
                uploaded = true;
            }
        } catch (e) {
            console.log('Strategy 3 failed:', e.message);
        }
    }

    if (!uploaded) {
        console.log('❌ Could not upload file. Taking screenshot...');
        await page.screenshot({ path: path.join(__dirname, 'debug_upload_fail.png') });
        console.log('Screenshot saved: debug_upload_fail.png');
    } else {
        console.log('\n[3] Video selected. Waiting for upload UI...');
        await page.waitForTimeout(3000);

        // Quét popup ngay sau khi chọn file
        await scanPopups('AFTER_FILE_SELECT');
        await scanAllButtons('AFTER_FILE_SELECT_BUTTONS');

        // 4. Đợi upload hoàn thành (Cancel button biến mất)
        console.log('\n[4] Waiting for upload to complete (Cancel button to disappear)...');
        try {
            await page.waitForSelector('button:has-text("Cancel")', { state: 'visible', timeout: 10000 });
            console.log('✅ Cancel button visible - uploading in progress...');
            
            // Monitor trong quá trình upload
            for (let i = 0; i < 12; i++) {
                await page.waitForTimeout(5000);
                console.log(`\n--- Polling ${i+1}/12 (${(i+1)*5}s) ---`);
                await scanPopups(`POLLING_${i+1}`);
                
                // Kiểm tra Cancel button còn không
                const cancelBtn = await page.$('button:has-text("Cancel")');
                if (!cancelBtn) {
                    console.log('✅ Cancel button gone - upload likely complete!');
                    break;
                }
            }
        } catch (e) {
            console.log('Cancel button wait:', e.message);
        }

        // 5. Quét popup sau khi upload xong
        console.log('\n[5] Scanning popups after upload complete...');
        await page.waitForTimeout(2000);
        await scanPopups('AFTER_UPLOAD_COMPLETE');
        await scanAllButtons('AFTER_UPLOAD_COMPLETE');

        // 6. Screenshot hiện trạng
        await page.screenshot({ path: path.join(__dirname, 'debug_upload_state.png'), fullPage: false });
        console.log('\n📸 Screenshot saved: debug_upload_state.png');

        // 7. Quét toàn bộ DOM để tìm confirm text
        console.log('\n[6] Scanning DOM for confirm/discard/leave text...');
        const confirmTexts = await page.evaluate(() => {
            const keywords = ['Are you sure', 'want to exit', 'leave', 'discard', 'cancel', 'automatic content', 'content check', 'Allow', 'Got it', 'OK', 'Confirm', 'Continue'];
            const results = [];
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (el.children.length === 0 && el.offsetParent !== null) {
                    const text = (el.innerText || el.textContent || '').trim();
                    if (keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 200) {
                        results.push({
                            tag: el.tagName,
                            text: text,
                            classes: (el.className || '').substring(0, 100)
                        });
                    }
                }
            }
            return results.slice(0, 30);
        });

        if (confirmTexts.length > 0) {
            console.log('🔍 Found text matching confirm/popup keywords:');
            for (const item of confirmTexts) {
                console.log(`  <${item.tag}> "${item.text}" | cls=${item.classes.substring(0, 60)}`);
            }
        } else {
            console.log('  No confirm/popup keyword text found in DOM.');
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Browser will stay open for 120 seconds for manual inspection.');
    console.log('Please check the browser and interact manually if needed.');
    console.log('='.repeat(60));

    // Giữ browser mở 120 giây để kiểm tra thủ công
    await page.waitForTimeout(120000);

} catch (err) {
    console.error('Fatal error:', err);
    await page.screenshot({ path: path.join(__dirname, 'debug_upload_error.png') }).catch(() => null);
}

await browser.close();
console.log('Browser closed. Script done.');
