import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { exec } from 'child_process';
import {
    computeNextScheduledTime,
    formatScheduleValue,
    getScheduleHintText,
    inferScheduleFieldKind,
    sortScheduleInputs
} from './schedule-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'tiktok.db');
const OLD_DB_PATH = path.join(DB_DIR, 'db.json');
const PROFILES_DIR = path.join(__dirname, '..', 'profiles');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const EXTENSIONS_DIR = path.join(__dirname, '..', 'extensions');
const URBAN_EXTENSION_PATH = path.join(EXTENSIONS_DIR, 'urban-vpn');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(EXTENSIONS_DIR)) fs.mkdirSync(EXTENSIONS_DIR);

// Init SQLite DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        status TEXT DEFAULT 'idle',
        video_folder TEXT,
        proxy TEXT,
        is_scheduled INTEGER DEFAULT 0,
        last_run TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

// Migration: Add proxy column if not exists
try {
    const tableInfo = db.prepare("PRAGMA table_info(profiles)").all();
    const hasProxy = tableInfo.some(col => col.name === 'proxy');
    if (!hasProxy) {
        db.exec("ALTER TABLE profiles ADD COLUMN proxy TEXT;");
        console.log('Added proxy column to profiles table');
    }
} catch (err) {
    console.error('Migration error (proxy column):', err);
}

// Migration: Add is_scheduled column if not exists
try {
    const tableInfo = db.prepare("PRAGMA table_info(profiles)").all();
    const hasScheduled = tableInfo.some(col => col.name === 'is_scheduled');
    if (!hasScheduled) {
        db.exec("ALTER TABLE profiles ADD COLUMN is_scheduled INTEGER DEFAULT 0;");
        console.log('Added is_scheduled column to profiles table');
    }
} catch (err) {
    console.error('Migration error (is_scheduled column):', err);
}

// Migration from db.json
if (fs.existsSync(OLD_DB_PATH)) {
    try {
        const oldData = JSON.parse(fs.readFileSync(OLD_DB_PATH, 'utf-8'));
        if (oldData.profiles) {
            const insertProfile = db.prepare('INSERT OR IGNORE INTO profiles (id, name, status) VALUES (?, ?, ?)');
            for (const p of oldData.profiles) {
                insertProfile.run(p.id, p.name, p.status || 'idle');
            }
        }
        if (oldData.config) {
            const insertConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
            Object.entries(oldData.config).forEach(([k, v]) => {
                insertConfig.run(k, String(v));
            });
        }
        // Rename old DB to avoid repeat migration
        fs.renameSync(OLD_DB_PATH, OLD_DB_PATH + '.bak');
        console.log('Migrated data from db.json to SQLite');
    } catch (err) {
        console.error('Migration error:', err);
    }
}

// Default config if missing
const getConfig = (key, defaultValue) => {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
};
const setConfig = (key, value) => {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
};

if (!getConfig('videoFolder', null)) setConfig('videoFolder', UPLOADS_DIR);
if (!getConfig('maxConcurrency', null)) setConfig('maxConcurrency', '2');

// Cleanup: Reset any stuck "uploading" profiles to "idle" on startup
db.prepare("UPDATE profiles SET status = 'idle' WHERE status = 'uploading'").run();
console.log('Reset stuck "uploading" profiles to "idle"');

// API Routes
app.get('/api/profiles', (req, res) => {
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all();
    res.json(profiles);
});

app.post('/api/profiles', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        const id = Date.now().toString();
        db.prepare('INSERT INTO profiles (id, name, status, is_scheduled) VALUES (?, ?, ?, ?)').run(id, name, 'idle', 0);
        res.json({ id, name, status: 'idle', is_scheduled: 0 });
    } catch (err) {
        res.status(400).json({ error: 'Profile already exists or database error' });
    }
});

app.delete('/api/profiles/:id', (req, res) => {
    db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.patch('/api/profiles/:id', (req, res) => {
    const { name, video_folder, proxy, is_scheduled } = req.body;
    const profileId = req.params.id;

    // Check if profile exists
    const currentProfile = db.prepare('SELECT name FROM profiles WHERE id = ?').get(profileId);
    if (!currentProfile) return res.status(404).json({ error: 'Profile not found' });

    if (name !== undefined) {
        if (currentProfile.name !== name) {
            // Check if new name exists
            const existing = db.prepare('SELECT id FROM profiles WHERE name = ?').get(name);
            if (existing) return res.status(400).json({ error: 'Profile name already exists' });

            // Rename folder
            const oldPath = path.join(PROFILES_DIR, currentProfile.name);
            const newPath = path.join(PROFILES_DIR, name);
            try {
                if (fs.existsSync(oldPath)) {
                    fs.renameSync(oldPath, newPath);
                    console.log(`Renamed profile folder from ${currentProfile.name} to ${name}`);
                }
                const result = db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name, profileId);
                console.log(`Database update for name: ${result.changes} rows affected`);
            } catch (err) {
                console.error('Rename folder error:', err);
                return res.status(500).json({ error: 'Failed to rename profile directory' });
            }
        }
    }
    if (video_folder !== undefined) {
        db.prepare('UPDATE profiles SET video_folder = ? WHERE id = ?').run(video_folder, profileId);
    }
    if (proxy !== undefined) {
        db.prepare('UPDATE profiles SET proxy = ? WHERE id = ?').run(proxy, profileId);
    }
    if (is_scheduled !== undefined) {
        const val = is_scheduled ? 1 : 0;
        db.prepare('UPDATE profiles SET is_scheduled = ? WHERE id = ?').run(val, profileId);
    }
    res.json({ success: true });
});

app.get('/api/config', (req, res) => {
    const rows = db.prepare('SELECT * FROM config').all();
    const config = {};
    rows.forEach(r => {
        // Convert to number if possible
        const val = r.value;
        config[r.key] = isNaN(val) ? val : Number(val);
    });
    res.json(config);
});

app.post('/api/select-folder', (req, res) => {
    let script = '';

    if (process.platform === 'darwin') {
        script = `osascript -e 'tell application (path to frontmost application as text) to POSIX path of (choose folder with prompt "Select Video Folder")'`;
    } else if (process.platform === 'win32') {
        script = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath"`;
    } else {
        return res.status(501).json({ error: 'Folder picker not supported on this platform' });
    }

    exec(script, (error, stdout, stderr) => {
        if (error) {
            console.error(`Folder picker error: ${error.message}`);
            return res.status(500).json({ error: 'Folder selection cancelled or failed' });
        }
        const selectedPath = stdout.trim();
        if (!selectedPath) return res.status(500).json({ error: 'No folder selected' });
        res.json({ path: selectedPath });
    });
});

app.post('/api/config', (req, res) => {
    Object.entries(req.body).forEach(([k, v]) => setConfig(k, v));
    res.json({ success: true });
});

// Automation Trigger
const runningProfiles = new Set();
const manualBrowsers = new Map(); // profileId -> browserContext


app.post('/api/start', async (req, res) => {
    const { profileId } = req.body;

    if (profileId) {
        const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (runningProfiles.has(profileId)) return res.status(400).json({ error: 'Profile already running' });

        runSingleProfile(profile);
        return res.json({ status: 'started', profile: profile.name });
    } else {
        const profiles = db.prepare('SELECT * FROM profiles').all();
        const idleProfiles = profiles.filter(p => !runningProfiles.has(p.id));
        if (idleProfiles.length === 0) return res.status(400).json({ error: 'No idle profiles' });

        runAllParallel(idleProfiles);
        return res.json({ status: 'started', count: idleProfiles.length });
    }
});

app.post('/api/open-profile', async (req, res) => {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (runningProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently running automation' });
    }

    if (manualBrowsers.has(profileId)) {
        return res.json({ status: 'already_open', message: 'Browser is already open' });
    }

    try {
        const userDataDir = path.join(PROFILES_DIR, profile.name);
        const browserOptions = {
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled'
            ]
        };

        const manifestPath = path.join(URBAN_EXTENSION_PATH, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            browserOptions.args.push(
                `--disable-extensions-except=${URBAN_EXTENSION_PATH}`,
                `--load-extension=${URBAN_EXTENSION_PATH}`
            );
            console.log(`[${profile.name}] Loading Urban VPN extension...`);
        } else {
            console.log(`[${profile.name}] Urban VPN extension not found or invalid (missing manifest.json). Skipping.`);
        }

        if (profile.proxy) {
            browserOptions.proxy = { server: profile.proxy };
        }

        const browser = await chromium.launchPersistentContext(userDataDir, browserOptions);
        manualBrowsers.set(profileId, browser);

        browser.on('close', () => {
            manualBrowsers.delete(profileId);
            console.log(`[${profile.name}] Manual browser closed`);
        });

        const page = await browser.newPage();
        await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded' }).catch(() => null);

        res.json({ status: 'opened', profile: profile.name });
    } catch (error) {
        console.error(`[${profile.name}] Failed to open browser:`, error);
        res.status(500).json({ error: `Failed to open browser: ${error.message}` });
    }
});


async function runAllParallel(profilesToRun) {
    const maxConcurrency = Number(getConfig('maxConcurrency', 2));
    const queue = [...profilesToRun];
    const active = [];

    async function processQueue() {
        while (queue.length > 0) {
            if (active.length >= maxConcurrency) {
                await Promise.race(active);
                continue;
            }
            const profile = queue.shift();
            const promise = runSingleProfile(profile).finally(() => {
                active.splice(active.indexOf(promise), 1);
            });
            active.push(promise);
        }
        await Promise.all(active);
    }

    processQueue().catch(err => console.error('Parallel execution error:', err));
}

const describeScheduleInput = (input) => {
    const hint = getScheduleHintText(input) || 'no-hint';
    return `#${input.index} kind=${inferScheduleFieldKind(input)} hint="${hint.slice(0, 80)}"`;
};

async function resolveScheduleInputs(page, log) {
    await page.waitForFunction(() => {
        const visibleInputs = Array.from(document.querySelectorAll('input.TUXTextInputCore-input')).filter((input) => {
            const style = window.getComputedStyle(input);
            const rect = input.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        });

        return visibleInputs.length >= 2;
    }, { timeout: 10000 }).catch(() => null);

    const locator = page.locator('input.TUXTextInputCore-input:visible');
    const count = await locator.count();
    const inputs = [];

    for (let index = 0; index < count; index++) {
        const meta = await locator.nth(index).evaluate((input) => {
            const rect = input.getBoundingClientRect();
            return {
                placeholder: input.getAttribute('placeholder') || '',
                ariaLabel: input.getAttribute('aria-label') || '',
                label: (input.closest('label')?.innerText || input.parentElement?.innerText || '').trim().slice(0, 120),
                name: input.getAttribute('name') || '',
                id: input.id || '',
                value: input.value || '',
                top: rect.top,
                left: rect.left
            };
        });

        inputs.push({ index, ...meta });
    }

    const orderedInputs = sortScheduleInputs(inputs);
    if (orderedInputs.length === 0) {
        throw new Error('No visible schedule inputs found');
    }

    log(`Visible schedule inputs: ${orderedInputs.map(describeScheduleInput).join(' | ')}`);

    const selected = { date: null, time: null };
    for (const input of orderedInputs) {
        const kind = inferScheduleFieldKind(input);
        if (kind === 'date' && !selected.date) selected.date = input;
        if (kind === 'time' && !selected.time) selected.time = input;
    }

    if (!selected.date) {
        selected.date = orderedInputs[0];
    }

    if (!selected.time) {
        selected.time = orderedInputs.find((input) => input.index !== selected.date?.index) || orderedInputs[1] || null;
    }

    return selected;
}

async function fillScheduleInput(page, inputMeta, value, label, log) {
    if (!inputMeta) {
        throw new Error(`${label} input not found`);
    }

    const input = page.locator('input.TUXTextInputCore-input:visible').nth(inputMeta.index);
    log(`Setting ${label} using ${describeScheduleInput(inputMeta)} => ${value}`);

    await input.scrollIntoViewIfNeeded();
    await input.click({ clickCount: 3 });
    await input.fill('');
    await input.type(value, { delay: 50 });
    await input.press('Tab').catch(() => null);
    await page.waitForTimeout(500);

    const actualValue = await input.inputValue().catch(() => '');
    log(`${label} input value after fill: ${actualValue || '<empty>'}`);

    if (actualValue && actualValue.trim() !== value) {
        log(`Warning: ${label} input mismatch after fill. Expected ${value}, got ${actualValue}`);
    }
}

async function runSingleProfile(profile) {
    if (runningProfiles.has(profile.id)) return;
    runningProfiles.add(profile.id);

    console.log(`[${profile.name}] Starting automation...`);
    db.prepare('UPDATE profiles SET status = ?, last_run = ? WHERE id = ?').run('uploading', new Date().toISOString(), profile.id);

    try {
        const videoFolder = profile.video_folder || getConfig('videoFolder', UPLOADS_DIR);
        let videos = [];
        try {
            if (!fs.existsSync(videoFolder)) {
                console.error(`[${profile.name}] Video folder does not exist: ${videoFolder}`);
                db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('error', profile.id);
                return;
            }
            videos = fs.readdirSync(videoFolder).filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.mp4' || ext === '.mov' || ext === '.webm';
            });
            console.log(`[${profile.name}] Found ${videos.length} videos in ${videoFolder}`);
        } catch (e) {
            console.error(`[${profile.name}] Folder error:`, e.message);
        }

        // Always open browser to allow login/session management
        const uploadedCount = await uploadVideo(profile, videoFolder, videos);

        if (uploadedCount > 0) {
            db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('success', profile.id);
        } else if (videos.length === 0) {
            db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('idle', profile.id);
        } else {
            db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('no_videos', profile.id);
        }
    } catch (error) {
        console.error(`[${profile.name}] Automation error:`, error);
        db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('error', profile.id);
    } finally {
        runningProfiles.delete(profile.id);
        setTimeout(() => {
            if (!runningProfiles.has(profile.id)) {
                db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('idle', profile.id);
            }
        }, 30000);
    }
}

async function uploadVideo(profile, videoFolder, videos) {
    const userDataDir = path.join(PROFILES_DIR, profile.name);
    const doneDir = path.join(videoFolder, 'done');
    let uploadedCount = 0;
    let lastScheduledTime = null;

    // Ensure done directory exists
    if (videos.length > 0 && !fs.existsSync(doneDir)) fs.mkdirSync(doneDir);

    const browserOptions = {
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled'
        ]
    };

    const manifestPath = path.join(URBAN_EXTENSION_PATH, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        browserOptions.args.push(
            `--disable-extensions-except=${URBAN_EXTENSION_PATH}`,
            `--load-extension=${URBAN_EXTENSION_PATH}`
        );
        console.log(`[${profile.name}] Loading Urban VPN extension for automation...`);
    } else {
        console.log(`[${profile.name}] Urban VPN extension not found or invalid for automation. Skipping.`);
    }

    if (profile.proxy) {
        console.log(`[${profile.name}] Using proxy: ${profile.proxy}`);
        browserOptions.proxy = { server: profile.proxy };
    }

    const browser = await chromium.launchPersistentContext(userDataDir, browserOptions);

    const log = (msg) => {
        const entry = `[${new Date().toISOString()}] [${profile.name}] ${msg}\n`;
        console.log(entry.trim());
        try {
            fs.appendFileSync(path.join(__dirname, 'automation.log'), entry);
        } catch (e) {
            console.error('Failed to write to log file:', e.message);
        }
    };

    try {
        const page = await browser.newPage();
        log(`Automation started for profile: ${profile.name}`);

        if (videos.length === 0) {
            log(`No compatible videos found in ${videoFolder}. Skipping.`);
            await browser.close();
            return 0;
        }

        for (let i = 0; i < videos.length; i++) {
            const videoFileName = videos[i];
            const videoPath = path.join(videoFolder, videoFileName);

            log(`Processing video ${i + 1}/${videos.length}: ${videoFileName}`);

            // Navigate to upload page
            await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });

            // On first video, wait longer in case login is needed
            if (i === 0) {
                log(`Waiting for upload page components (up to 20s)...`);
                try {
                    await Promise.race([
                        page.waitForSelector('input[type="file"]', { timeout: 20000 }),
                        page.waitForSelector('button.upload-stage-btn, .upload-stage-btn', { timeout: 20000 })
                    ]);
                    log(`Upload page ready.`);
                } catch (e) {
                    log(`Page initialization slow or login needed. Checking...`);
                    const debugPath = path.join(__dirname, `debug_${profile.name}_startup.png`);
                    await page.screenshot({ path: debugPath }).catch(() => null);
                }
            } else {
                await page.waitForTimeout(3000);
            }

            log(`Selecting file...`);
            let uploaded = false;

            // Strategy 1: Intercept filechooser
            const uploadButtonSelectors = ['button.upload-stage-btn', 'button:has-text("Select videos")', '.upload-stage-btn', 'button[class*="upload"]'];
            for (const sel of uploadButtonSelectors) {
                try {
                    const el = await page.$(sel);
                    if (el) {
                        log(`Found upload button: ${sel}. Intercepting filechooser...`);
                        const [fileChooser] = await Promise.all([
                            page.waitForEvent('filechooser', { timeout: 8000 }),
                            el.click()
                        ]);
                        await fileChooser.setFiles(videoPath);
                        log(`Strategy 1 success via ${sel}`);
                        uploaded = true;
                        break;
                    }
                } catch (e) {}
            }

            if (!uploaded) {
                log(`Strategy 2: unhide input and setInputFiles...`);
                try {
                    await page.evaluate(() => {
                        const input = document.querySelector('input[type="file"]');
                        if (input) {
                            input.style.display = 'block';
                            input.style.visibility = 'visible';
                            input.style.opacity = '1';
                            input.style.position = 'fixed';
                            input.style.top = '0';
                            input.style.left = '0';
                            input.style.zIndex = '99999';
                        }
                    });
                    await page.waitForTimeout(500);
                    const [fileChooser] = await Promise.all([
                        page.waitForEvent('filechooser', { timeout: 5000 }),
                        page.click('input[type="file"]')
                    ]);
                    await fileChooser.setFiles(videoPath);
                    log(`Strategy 2 success`);
                    uploaded = true;
                } catch (e) {}
            }

            if (!uploaded) throw new Error('Could not find file input or upload button');

            log(`Video file selection complete. Waiting for UI...`);
            await page.waitForTimeout(3000);
            
            // --- NEW TASKS: Clear Title & Add Sound ---
            try {
                log(`Waiting for upload UI components...`);
                await page.waitForSelector('.video-info-container, textarea, .DraftEditor-root, button:has-text("Edit video"), [data-button-name="sounds"], button:has-text("Post")', { timeout: 60000 });
                await page.waitForTimeout(5000);

                log(`Task 1: Clearing title/caption...`);
                const captionSelectors = ['textarea', '.DraftEditor-root', '[role="textbox"]', '[contenteditable="true"]', '.public-DraftEditor-content', '[data-e2e="caption-edit-container"]'];
                for (const sel of captionSelectors) {
                    try {
                        const caption = await page.waitForSelector(sel, { timeout: 5000, state: 'visible' }).catch(() => null);
                        if (caption) {
                            log(`Found caption field: ${sel}. Clearing text...`);
                            await caption.focus();
                            await caption.click({ clickCount: 3 });
                            await page.keyboard.press('Control+A');
                            await page.keyboard.press('Meta+A');
                            await page.keyboard.press('Backspace');
                            await page.waitForTimeout(500);
                            log(`Caption clearing attempt finished.`);
                        }
                    } catch (e) {}
                }

                log(`Task 2: Handling Editor and Sound selection...`);
                let soundsBtn = await page.$('button[data-button-name="sounds"]');
                if (!soundsBtn) {
                    const editButton = await page.$('button:has-text("Edit video"), .edit-video-btn, [data-e2e="edit-video-button"], button:has-text("Edit")');
                    if (editButton && await editButton.isVisible()) {
                        log(`Clicking Edit Video button...`);
                        await editButton.click();
                        await page.waitForSelector('button[data-button-name="sounds"]', { timeout: 30000, state: 'visible' });
                        soundsBtn = await page.$('button[data-button-name="sounds"]');
                    }
                }

                if (soundsBtn) {
                    log(`Opening Sounds panel...`);
                    await soundsBtn.click();
                    await page.waitForTimeout(3000); // Wait for panel to open
                    
                    // Screenshot before tab click
                    await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_before_fav_click.png`) }).catch(() => null);

                    // Refined selector using exact attribute provided by user
                    const favTab = 'button[role="tab"][aria-controls="panel-favorites"], button[role="tab"]:has-text("Favorites")';
                    log(`Waiting for Favorites tab: ${favTab}`);
                    
                    try {
                        const tab = await page.waitForSelector(favTab, { timeout: 10000, state: 'visible' });
                        if (tab) {
                            log(`Found tab. Clicking via evaluate...`);
                            await tab.evaluate(el => el.click());
                        }
                    } catch (e) {
                        log(`Failed to find favorites tab: ${e.message}`);
                    }
                    
                    log(`Tab click result: waiting 3s...`);
                    await page.waitForTimeout(3000);
                    
                    // Screenshot after tab click
                    await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_after_fav_click.png`) }).catch(() => null);

                    // Click the first plus button INSIDE the favorites panel
                    // We need to be very specific to avoid clicking sidebar or other unrelated plus icons
                    log(`Looking for Plus button in Favorites panel list...`);
                    
                    let soundAdded = false;
                    try {
                        // 1. Try to find the panel or the list container
                        const listSelectors = [
                            '#panel-favorites', 
                            '[aria-controls="panel-favorites"] ~ div', 
                            '.music-list', 
                            '.MusicPanel__list',
                            'div[class*="MusicPanel"]'
                        ];
                        
                        let listContainer = null;
                        for (const sel of listSelectors) {
                            const found = await page.$(sel);
                            if (found && await found.isVisible()) {
                                listContainer = found;
                                log(`Found list container via ${sel}`);
                                break;
                            }
                        }
                        
                        // 2. Find rows/items inside the list
                        const itemSelectors = ['div[class*="ListItem"]', 'div[class*="item"]', 'div[role="listitem"]', '.music-item'];
                        let firstItem = null;
                        if (listContainer) {
                            for (const sel of itemSelectors) {
                                const found = await listContainer.$(sel);
                                if (found && await found.isVisible()) {
                                    firstItem = found;
                                    log(`Found first music item via ${sel}`);
                                    break;
                                }
                            }
                        }
                        
                        // 3. Find plus icon inside the first item
                        if (firstItem) {
                            const icon = await firstItem.$('[data-icon="plus-bold"]');
                            if (icon) {
                                log(`Found plus icon inside music item. Finding parent button...`);
                                const parentButton = await icon.evaluateHandle(el => el.closest('button') || el);
                                await parentButton.scrollIntoViewIfNeeded();
                                await parentButton.click({ force: true });
                                log(`Favorite sound added via item-specific parent button.`);
                                soundAdded = true;

                                // After sound is added, enter -50 in the PropSettingInput
                                log(`Waiting for PropSettingInput to appear...`);
                                await page.waitForTimeout(1500);
                                const propInput = await page.waitForSelector(
                                    'input.PropSettingInput__input, input[class*="PropSettingInput"]',
                                    { timeout: 8000, state: 'visible' }
                                ).catch(() => null);
                                if (propInput) {
                                    log(`Found PropSettingInput. Entering -50...`);
                                    await propInput.click({ clickCount: 3 });
                                    await propInput.fill('-50');
                                    await page.keyboard.press('Enter');
                                    log(`Entered -50 into PropSettingInput.`);
                                } else {
                                    log(`PropSettingInput not found. Skipping.`);
                                }
                            }
                        }
                        
                        // Fallback: If sequence failed, try to find ANY visible plus-bold icon that is NOT in the sidebar
                        if (!soundAdded) {
                            log(`Item-specific search failed. Trying filtered plus icons...`);
                            const allIcons = await page.$$('[data-icon="plus-bold"]');
                            for (const icon of allIcons) {
                                const inSidebar = await icon.evaluate(el => el.closest('[class*="Sidebar"]') || el.closest('[class*="sidebar"]'));
                                if (!inSidebar && await icon.isVisible()) {
                                    const parentButton = await icon.evaluateHandle(el => el.closest('button') || el);
                                    await parentButton.scrollIntoViewIfNeeded();
                                    await parentButton.click({ force: true });
                                    log(`Favorite sound added via filtered icon.`);
                                    soundAdded = true;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        log(`Error in plus button selection: ${e.message}`);
                    }

                    await page.waitForTimeout(2000);

                    const saveBtn = 'button:has-text("Save"), .save-btn, button.jsx-2503522271.save-btn';
                    const sBtn = await page.waitForSelector(saveBtn, { timeout: 10000, state: 'visible' }).catch(() => null);
                    if (sBtn) {
                        await sBtn.click();
                        log(`Changes saved in editor.`);
                        await page.waitForSelector('button:has-text("Post")', { timeout: 30000, state: 'visible' });
                        await page.waitForTimeout(2000);
                    }
                } else {
                    log(`Editor/Sounds button not found. Skipping editor steps.`);
                }
            } catch (e) {
                log(`New tasks failed: ${e.message}`);
                await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_task_fail.png`) }).catch(() => null);
            }
            // --- END NEW TASKS ---

            // --- TASK 3: Scheduled Publishing ---
            if (profile.is_scheduled && i >= 3) {
                try {
                    log(`Task 3: Scheduling video ${i + 1}...`);
                    
                    // 1. Calculate schedule time
                    lastScheduledTime = computeNextScheduledTime({
                        index: i,
                        lastScheduledTime,
                        now: new Date()
                    });

                    if (lastScheduledTime) {
                        const dateStr = formatScheduleValue(lastScheduledTime, 'date');
                        const timeStr = formatScheduleValue(lastScheduledTime, 'time');
                        log(`Target schedule (Local): ${dateStr} ${timeStr}`);

                        // 2. Click "Schedule" radio
                        const scheduleRadio = 'input[value="schedule"]';
                        log(`Waiting for schedule radio: ${scheduleRadio}`);
                        const scheduleRadioInput = page.locator(scheduleRadio).first();
                        await scheduleRadioInput.waitFor({ timeout: 15000, state: 'attached' });
                        await scheduleRadioInput.scrollIntoViewIfNeeded().catch(() => null);
                        await scheduleRadioInput.check({ force: true }).catch(async () => {
                            await scheduleRadioInput.click({ force: true });
                        });
                        
                        log(`Selected "Schedule" option.`);
                        await page.waitForTimeout(3000);

                        // 3. Resolve visible date/time inputs and fill them via Playwright
                        const scheduleInputs = await resolveScheduleInputs(page, log);
                        const resolvedDateValue = formatScheduleValue(lastScheduledTime, 'date', scheduleInputs.date || {});
                        const resolvedTimeValue = formatScheduleValue(lastScheduledTime, 'time', scheduleInputs.time || {});

                        await fillScheduleInput(page, scheduleInputs.date, resolvedDateValue, 'Date', log);
                        await fillScheduleInput(page, scheduleInputs.time, resolvedTimeValue, 'Time', log);
                        
                        await page.waitForTimeout(3000); // Increased wait for UI to settle
                        
                        // Verification screenshot
                        await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_scheduled_${i+1}.png`) }).catch(() => null);
                    }
                } catch (e) {
                    log(`Scheduling task failed: ${e.message}`);
                }
            }
            // --- END TASK 3 ---

            log(`Starting Post click sequence...`);
            let clickedPost = false;
            for (let clickAttempt = 0; clickAttempt < 10; clickAttempt++) {
                await dismissPopups(page);
                
                const postSelectors = [
                    'button.common-button-post-video',
                    '[data-e2e="post_video_button"]',
                    'button:has-text("Post"):not(:has-text("draft"))',
                ];
                
                let targetBtn = null;
                for (const sel of postSelectors) {
                    const btn = await page.$(sel);
                    if (btn && await btn.isVisible() && !await btn.isDisabled()) {
                        targetBtn = btn;
                        break;
                    }
                }

                if (targetBtn) {
                    log(`Clicking Post button (Attempt ${clickAttempt + 1})...`);
                    try {
                        // Strategy A: Real browser click
                        await targetBtn.click({ force: true, timeout: 5000 });
                    } catch (e) {
                        // Strategy B: Evaluate click fallback
                        await targetBtn.evaluate(node => node.click()).catch(() => null);
                    }
                    await dismissPopups(page);
                }
                
                // Success detection polling (Wait up to 15s per attempt)
                for (let poll = 0; poll < 3; poll++) {
                    await page.waitForTimeout(5000);
                    
                    const postBtnGone = !await page.$('button:has-text("Post")');
                    const successMsg = await page.$('text="Uploaded", text="Success", text="View video", text="Manage your posts", text="Share video"');
                    const redirected = !page.url().includes('upload') || page.url().includes('manage') || page.url().includes('content');

                    if (postBtnGone || successMsg || redirected) {
                        log(`Post confirmed! (btnGone: ${postBtnGone}, msg: ${!!successMsg}, redirected: ${redirected})`);
                        clickedPost = true;
                        break;
                    }
                    
                    // Check if button text changed to "Posting..."
                    const btnText = await targetBtn?.innerText().catch(() => "");
                    if (btnText?.includes("Posting")) {
                        log("Status: Posting in progress...");
                    }
                    
                    await dismissPopups(page);
                }

                if (clickedPost) break;
            }

            if (clickedPost) {
                log(`Finalizing upload for ${videoFileName}...`);
                try {
                    if (fs.existsSync(videoPath)) {
                        fs.renameSync(videoPath, path.join(doneDir, videoFileName));
                        log(`SUCCESS: Moved ${videoFileName} to ${doneDir}`);
                    }
                    uploadedCount++;
                } catch (err) { 
                    log(`ERROR moving file: ${err.message}`); 
                }
            }
        }
        return uploadedCount;
    } catch (error) {
        fs.appendFileSync(path.join(__dirname, 'automation.log'), `[${new Date().toISOString()}] CRITICAL ERROR: ${error.message}\n${error.stack}\n`);
        throw error;
    } finally {
        log(`Automation session ended.`);
        await browser.close().catch(() => null);
    }
}

const dismissPopups = async (page) => {
    if (!page) return false;
    const modalSelectors = ['div[role="dialog"]', 'div[class*="modal"]', 'div[class*="Modal"]', 'div[class*="portal"]', 'div[class*="dialog"]'];
    for (const modalSel of modalSelectors) {
        try {
            const modal = await page.$(modalSel);
            if (modal && await modal.isVisible()) {
                const text = await modal.innerText();
                if (text.includes("Are you sure you want to exit")) {
                    const cancelBtn = await modal.$('button:has-text("Cancel")');
                    if (cancelBtn) await cancelBtn.click();
                    return true;
                }
                const btnSelectors = ['button:has-text("Turn on")', 'button:has-text("Allow")', 'button:has-text("Got it")', 'button:has-text("Skip")', 'button:has-text("Cancel")'];
                for (const btnSel of btnSelectors) {
                    const btn = await modal.$(btnSel);
                    if (btn && await btn.isVisible()) {
                        await btn.click();
                        return true;
                    }
                }
            }
        } catch (e) { }
    }
    return false;
};

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
