import { chromium } from 'playwright';
import path from 'path';

const PROFILES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'profiles');
const userDataDir = path.join(PROFILES_DIR, '_inspect_hotmail2');

console.log('=== INSPECT HOTMAIL LOGIN FLOW (FULL) ===\n');

const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
});

const page = await browser.newPage();

async function logInputs(page) {
    const inputs = await page.evaluate(() => {
        const all = document.querySelectorAll('input:not([type="hidden"])');
        return [...all].map(i => ({
            type: i.type || 'text',
            name: i.getAttribute('name') || '',
            id: i.id || '',
            placeholder: i.getAttribute('placeholder') || '',
            visible: i.offsetParent !== null
        }));
    }).catch(() => []);
    console.log(`  Inputs: ${JSON.stringify(inputs, null, 2)}`);
}

async function logButtons(page) {
    const buttons = await page.evaluate(() => {
        const all = document.querySelectorAll(
            'button, input[type="submit"], input[type="button"], ' +
            'div[role="button"], a[role="button"], span[role="button"], ' +
            'span[class*="Link"], a[class*="link"], span[class*="clickable"]'
        );
        return [...all].filter(el => el.offsetParent !== null).map(el => {
            const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').substring(0, 100).trim();
            return { tag: el.tagName, id: el.id || '', text };
        });
    }).catch(() => []);
    console.log(`  Visible buttons/links: ${JSON.stringify(buttons, null, 2)}`);
}

async function logBodySnippet(page) {
    const body = await page.evaluate(() => {
        return (document.body.innerText || '').substring(0, 800);
    }).catch(() => '');
    console.log(`  Body:\n---\n${body}\n---`);
}

// ========== STEP 1: Navigate to Outlook ==========
console.log('[1] Navigating to outlook.office.com/mail/...');
await page.goto('https://outlook.office.com/mail/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
});
await page.waitForTimeout(5000);

console.log(`URL: ${page.url()}`);
console.log('--- INITIAL PAGE ---');
await logBodySnippet(page);
await logInputs(page);
await logButtons(page);
await page.screenshot({ path: 'debug_hotmail_s1_initial.png' });

// ========== STEP 2: Enter email + click Next ==========
console.log('\n[2] Entering email...');
const emailInput = await page.waitForSelector(
    'input[type="email"], input[name="loginfmt"], input#i0116',
    { timeout: 5000 }
).catch(() => null);

if (!emailInput) {
    console.log('No email input found. Exiting.');
    await browser.close();
    process.exit(0);
}

await emailInput.fill('test_user@hotmail.com');
await page.waitForTimeout(500);

const nextBtn = await page.$('input[type="submit"], button[type="submit"], #idSIButton9');
if (nextBtn) await nextBtn.click();
console.log('Clicked Next');
await page.waitForTimeout(5000);

console.log(`URL: ${page.url()}`);
console.log('--- AFTER NEXT ---');
await logBodySnippet(page);
await logInputs(page);
await logButtons(page);
await page.screenshot({ path: 'debug_hotmail_s2_verify_email.png' });

// ========== STEP 3: Click "Use your password" ==========
console.log('\n[3] Looking for "Use your password" link...');
const usePwSelectors = [
    'span:has-text("Use your password")',
    ':text("Use your password")',
    'a:has-text("Use your password")',
    'button:has-text("password")',
    'span[class*="Link"]:has-text("password")',
    'a.fui-Link',
];
let usePwBtn = null;
for (const sel of usePwSelectors) {
    usePwBtn = await page.$(sel);
    if (usePwBtn && await usePwBtn.isVisible().catch(() => false)) {
        console.log(`  Found via: ${sel}`);
        break;
    }
    usePwBtn = null;
}

if (!usePwBtn) {
    console.log('⚠️ "Use your password" not found!');
    // Let's try to find any element containing "password"
    const debug = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        const found = [];
        for (const el of all) {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (text === 'use your password' && el.offsetParent !== null) {
                found.push({ tag: el.tagName, id: el.id, class: el.className.substring(0, 100), text });
            }
        }
        return found;
    }).catch(() => []);
    console.log(`  Debug - elements with "Use your password": ${JSON.stringify(debug, null, 2)}`);
} else {
    await usePwBtn.click();
    console.log('  Clicked "Use your password"');
    await page.waitForTimeout(5000);

    console.log(`URL: ${page.url()}`);
    console.log('--- AFTER "USE YOUR PASSWORD" ---');
    await logBodySnippet(page);
    await logInputs(page);
    await logButtons(page);
    await page.screenshot({ path: 'debug_hotmail_s3_password_screen.png' });

    // ========== STEP 4: Check for password field ==========
    console.log('\n[4] Checking for password field...');
    const passInput = await page.$('input[type="password"][name="passwd"], input#i0118, input[type="password"]');
    if (passInput) {
        const passVisible = await passInput.isVisible().catch(() => false);
        console.log(`  Password input found, visible: ${passVisible}`);
    } else {
        console.log('  No password input in DOM!');
        await logInputs(page);
    }

    await page.screenshot({ path: 'debug_hotmail_s4_check_password.png' });
}

// Also: check what "Already received a code?" does
// Go back and test that too? No - let's focus on the password flow.

console.log('\n=== Browser stays open for 30s ===');
await page.waitForTimeout(30000);
await browser.close();
console.log('Done.');
