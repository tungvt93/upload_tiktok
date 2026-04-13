import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSIONS_DIR = path.join(__dirname, '..', 'extensions');
const URBAN_EXTENSION_PATH = path.join(EXTENSIONS_DIR, 'urban-vpn');
const PROFILES_DIR = path.join(__dirname, '..', 'profiles');
const userDataDir = path.join(PROFILES_DIR, 'debug_profile_final_check');

async function run() {
    console.log(`Checking extension path: ${URBAN_EXTENSION_PATH}`);
    const manifestPath = path.join(URBAN_EXTENSION_PATH, 'manifest.json');
    console.log(`Manifest exists: ${fs.existsSync(manifestPath)}`);

    const browserOptions = {
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled'
        ]
    };

    if (fs.existsSync(manifestPath)) {
        browserOptions.args.push(
            `--disable-extensions-except=${URBAN_EXTENSION_PATH}`,
            `--load-extension=${URBAN_EXTENSION_PATH}`
        );
        console.log('Valid extension found, adding to launch args.');
    }

    const context = await chromium.launchPersistentContext(userDataDir, browserOptions);
    const page = await context.newPage();
    
    await page.goto('chrome://extensions');
    await page.waitForTimeout(5000);
    const screenshotPath = path.join(__dirname, 'final_extension_check_v2.png');
    await page.screenshot({ path: screenshotPath });
    
    console.log('Screenshot saved to:', screenshotPath);
    await context.close();
}

run().catch(console.error);
