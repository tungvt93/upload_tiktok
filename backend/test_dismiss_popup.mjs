/**
 * Script TEST dismiss popup - kiểm tra xem dismissPopups mới có hoạt động không
 * Profile: user4211610817667
 * Video: dummy_videos/dummy_upload.mp4
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
console.log('TEST DISMISS POPUP - với code mới');
console.log('Profile:', PROFILE_NAME);
console.log('='.repeat(60));

// ---- Copy logic dismissPopups MỚI từ server.js ----
const dismissPopups = async (page) => {
    if (!page) return false;

    const modalSelectors = [
        'div[role="dialog"]',
        'div.TUXModal:not(.TUXModal-overlay)',
        'div[class*="common-modal"]:not([class*="overlay"])',
        'div[class*="modal"]:not([class*="overlay"])',
        'div[class*="Modal"]:not([class*="overlay"])',
        'div[class*="portal"]',
        'div[class*="dialog"]',
    ];

    for (const modalSel of modalSelectors) {
        try {
            const modals = await page.$$(modalSel);
            for (const modal of modals) {
                try {
                    if (!await modal.isVisible()) continue;

                    const text = await modal.innerText().catch(() => '');
                    if (!text.trim()) continue;

                    // Popup "Turn on automatic content checks?" → Cancel
                    if (text.includes("automatic content checks") || text.includes("content checks") || text.includes("Turn on automatic")) {
                        const cancelBtn = await modal.$('button:has-text("Cancel")');
                        if (cancelBtn && await cancelBtn.isVisible()) {
                            await cancelBtn.click();
                            console.log('✅ [dismissPopups] Dismissed "Turn on automatic content checks" → Cancel');
                            return true;
                        }
                    }

                    // Popup "Are you sure you want to exit?"
                    if (text.includes("Are you sure you want to exit") || text.includes("want to leave") || text.includes("Leave page")) {
                        const cancelBtn = await modal.$('button:has-text("Cancel"), button:has-text("Stay"), button:has-text("No")');
                        if (cancelBtn && await cancelBtn.isVisible()) {
                            await cancelBtn.click();
                            console.log('✅ [dismissPopups] Dismissed "exit/leave" popup → Cancel/Stay');
                            return true;
                        }
                    }

                    // Generic popups: Got it, Allow, Skip, OK
                    const genericBtnSelectors = [
                        'button:has-text("Got it")',
                        'button:has-text("Allow")',
                        'button:has-text("Skip")',
                        'button:has-text("OK")',
                        'button:has-text("Okay")',
                        'button:has-text("Close")',
                    ];
                    for (const btnSel of genericBtnSelectors) {
                        const btn = await modal.$(btnSel);
                        if (btn && await btn.isVisible()) {
                            await btn.click();
                            console.log(`✅ [dismissPopups] Dismissed generic popup → ${btnSel}`);
                            return true;
                        }
                    }
                } catch (innerE) { }
            }
        } catch (e) { }
    }
    return false;
};

// ---- Hàm kiểm tra popup còn không ----
async function checkPopupStillVisible(page, label) {
    const visible = await page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"], div.TUXModal:not(.TUXModal-overlay)');
        if (!modal) return null;
        const rect = modal.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return null;
        return {
            text: (modal.innerText || '').substring(0, 100).trim(),
            classes: (modal.className || '').substring(0, 80)
        };
    });
    if (visible) {
        console.log(`❌ [${label}] Popup VẪN CÒN: "${visible.text}"`);
    } else {
        console.log(`✅ [${label}] Không còn popup!`);
    }
    return !!visible;
}

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
});

const page = await browser.newPage();

try {
    console.log('\n[1] Mở trang upload TikTok...');
    await page.goto('https://www.tiktok.com/creator-center/upload?lang=en', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    await page.waitForTimeout(3000);

    console.log('\n[2] Upload video...');
    let uploaded = false;

    // Strategy 1: Direct file input
    try {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(videoPath);
            console.log('✅ Strategy 1 success');
            uploaded = true;
        }
    } catch (e) { console.log('Strategy 1 failed:', e.message); }

    // Strategy 2: Click Select video button
    if (!uploaded) {
        try {
            const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 8000 }),
                page.click('button:has-text("Select video"), button:has-text("Upload")')
            ]);
            await fileChooser.setFiles(videoPath);
            console.log('✅ Strategy 2 success');
            uploaded = true;
        } catch (e) { console.log('Strategy 2 failed:', e.message); }
    }

    if (!uploaded) {
        console.log('❌ Không upload được!');
        await browser.close();
        process.exit(1);
    }

    // Đợi popup xuất hiện
    console.log('\n[3] Đợi 4 giây để popup xuất hiện...');
    await page.waitForTimeout(4000);

    // Kiểm tra popup có xuất hiện không
    const popupBefore = await checkPopupStillVisible(page, 'BEFORE_DISMISS');
    await page.screenshot({ path: path.join(__dirname, 'test_before_dismiss.png') });
    console.log('📸 Screenshot before: test_before_dismiss.png');

    if (popupBefore) {
        console.log('\n[4] Popup phát hiện! Chạy dismissPopups...');
        const result = await dismissPopups(page);
        console.log(`dismissPopups returned: ${result}`);
        
        await page.waitForTimeout(1500);
        
        const popupAfter = await checkPopupStillVisible(page, 'AFTER_DISMISS');
        await page.screenshot({ path: path.join(__dirname, 'test_after_dismiss.png') });
        console.log('📸 Screenshot after: test_after_dismiss.png');

        if (!popupAfter) {
            console.log('\n🎉 SUCCESS! dismissPopups hoạt động đúng!');
        } else {
            console.log('\n❌ FAILED! dismissPopups KHÔNG dismiss được popup!');
            
            // Debug: liệt kê các elements visible
            const debug = await page.evaluate(() => {
                const modals = document.querySelectorAll('div[role="dialog"], div.TUXModal');
                return [...modals].map(m => ({
                    classes: m.className.substring(0, 100),
                    visible: m.offsetParent !== null,
                    rect: m.getBoundingClientRect(),
                    btns: [...m.querySelectorAll('button')].map(b => b.innerText.trim())
                }));
            });
            console.log('Debug modal elements:', JSON.stringify(debug, null, 2));
        }
    } else {
        console.log('\n⚠️  Không thấy popup sau 4s. Có thể popup chưa xuất hiện hoặc đã bị dismiss tự động.');
        console.log('Đợi thêm 10s...');
        await page.waitForTimeout(10000);
        await checkPopupStillVisible(page, 'AFTER_10S_WAIT');
        await page.screenshot({ path: path.join(__dirname, 'test_10s_state.png') });
        console.log('📸 Screenshot: test_10s_state.png');
    }

    // Test loop: simulate upload wait loop (chạy dismiss liên tục 30s)
    console.log('\n[5] Test dismiss loop (30s)...');
    for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(3000);
        const dismissed = await dismissPopups(page);
        
        // Check Post button
        const postBtn = await page.$('button[data-e2e="post_video_button"]:not([disabled]), button.common-button-post-video:not([disabled])');
        const postVisible = postBtn && await postBtn.isVisible().catch(() => false);
        
        console.log(`Loop ${i+1}/10: dismissed=${dismissed}, postBtnVisible=${postVisible}`);
        
        if (postVisible) {
            console.log('✅ Post button xuất hiện và enabled! Upload hoàn thành!');
            break;
        }
    }

    await page.screenshot({ path: path.join(__dirname, 'test_final_state.png') });
    console.log('\n📸 Final screenshot: test_final_state.png');

    console.log('\n='.repeat(60));
    console.log('Browser giữ nguyên 60s để bạn kiểm tra thủ công...');
    await page.waitForTimeout(60000);

} catch (err) {
    console.error('Fatal:', err.message);
    await page.screenshot({ path: path.join(__dirname, 'test_error.png') }).catch(() => null);
}

await browser.close();
console.log('Done.');
