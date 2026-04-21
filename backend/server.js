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
    computeAutoIncrementTime,
    parseScheduleValue,
    formatScheduleValue,
    getScheduleHintText,
    inferScheduleFieldKind,
    sortScheduleInputs
} from './schedule-utils.js';
import {
    initGroupSchema,
    listGroups,
    createGroup,
    renameGroup,
    deleteGroup,
    assertGroupExists
} from './group-store.js';
import { createProfileRecord } from './profile-store.js';
import { randomUUID } from 'node:crypto';

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
    CREATE TABLE IF NOT EXISTS profile_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT,
        time TEXT,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
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

initGroupSchema(db);

// Migration: Add group_id column to profiles if not exists
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasGroupId = tableInfo.some((col) => col.name === 'group_id');
    if (!hasGroupId) {
        db.exec('ALTER TABLE profiles ADD COLUMN group_id TEXT;');
        console.log('Added group_id column to profiles table');
    }
} catch (err) {
    console.error('Migration error (group_id column):', err);
}

// Migration: set_music — khi bật mới chạy Edit video + chọn nhạc khi upload
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasSetMusic = tableInfo.some((col) => col.name === 'set_music');
    if (!hasSetMusic) {
        db.exec('ALTER TABLE profiles ADD COLUMN set_music INTEGER DEFAULT 0;');
        db.prepare('UPDATE profiles SET set_music = 1').run();
        console.log('Added set_music column to profiles (existing rows default to on)');
    }
} catch (err) {
    console.error('Migration error (set_music column):', err);
}

// Migration: auto_increment_schedule — Lên lịch nối tiếp (+5 phút mỗi video)
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasAutoIncrement = tableInfo.some((col) => col.name === 'auto_increment_schedule');
    if (!hasAutoIncrement) {
        db.exec('ALTER TABLE profiles ADD COLUMN auto_increment_schedule INTEGER DEFAULT 0;');
        console.log('Added auto_increment_schedule column to profiles table');
    }
} catch (err) {
    console.error('Migration error (auto_increment_schedule column):', err);
}

// Migration: upload_count — Số lượng video upload mỗi lần
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasUploadCount = tableInfo.some((col) => col.name === 'upload_count');
    if (!hasUploadCount) {
        db.exec('ALTER TABLE profiles ADD COLUMN upload_count INTEGER DEFAULT 1;');
        console.log('Added upload_count column to profiles table');
    }
} catch (err) {
    console.error('Migration error (upload_count column):', err);
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

function normalizeGroupId(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const s = typeof value === 'string' ? value : String(value);
    const trimmed = s.trim();
    return trimmed.length === 0 ? null : trimmed;
}

function parseProxy(proxyStr) {
    if (!proxyStr) return null;
    let server, username, password;

    // Remove protocol first if present
    let raw = proxyStr;
    const protocolMatch = proxyStr.match(/^(\w+):\/\//);
    let protocol = 'http';
    if (protocolMatch) {
        protocol = protocolMatch[1];
        raw = proxyStr.slice(protocolMatch[0].length);
    }

    // Handle user:pass@host:port
    if (raw.includes('@')) {
        const [auth, hostPort] = raw.split('@');
        const [user, pass] = auth.split(':');
        username = user;
        password = pass;
        server = `${protocol}://${hostPort}`;
    } 
    // Handle host:port:user:pass
    else if (raw.split(':').length === 4) {
        const parts = raw.split(':');
        server = `${protocol}://${parts[0]}:${parts[1]}`;
        username = parts[2];
        password = parts[3];
    } 
    // Handle host:port or protocol://host:port
    else {
        server = proxyStr.includes('://') ? proxyStr : `http://${proxyStr}`;
    }

    return { server, username, password };
}

// API Routes
app.get('/api/profiles', (req, res) => {
    const profiles = db
        .prepare(
            `
            SELECT
                p.*,
                g.name AS group_name,
                (SELECT group_concat(time) FROM profile_schedules WHERE profile_id = p.id) as schedules
            FROM profiles p
            LEFT JOIN groups g ON g.id = p.group_id
            ORDER BY p.created_at DESC
        `
        )
        .all();
    res.json(profiles.map(p => ({
        ...p,
        schedules: p.schedules ? p.schedules.split(',') : []
    })));
});

app.post('/api/profiles', (req, res) => {
    const { name, group_id, video_folder } = req.body;

    try {
        const id = Date.now().toString();
        const profile = createProfileRecord(db, {
            id,
            name,
            group_id,
            video_folder
        });
        res.json(profile);
    } catch (err) {
        res.status(err.status || 400).json({
            error: err.message || 'Profile already exists or database error'
        });
    }
});

app.delete('/api/profiles/:id', (req, res) => {
    db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.patch('/api/profiles/:id', (req, res) => {
    const { name, video_folder, proxy, is_scheduled, auto_increment_schedule, set_music, upload_count } = req.body;
    const profileId = req.params.id;

    // Check if profile exists
    const currentProfile = db.prepare('SELECT name FROM profiles WHERE id = ?').get(profileId);
    if (!currentProfile) return res.status(404).json({ error: 'Profile not found' });

    if ('group_id' in req.body) {
        const normalizedGroupId = normalizeGroupId(req.body.group_id);
        if (normalizedGroupId !== undefined) {
            if (normalizedGroupId !== null) {
                try {
                    assertGroupExists(db, normalizedGroupId);
                } catch (err) {
                    return res
                        .status(err.status || 400)
                        .json({ error: err.message });
                }
            }
            db.prepare('UPDATE profiles SET group_id = ? WHERE id = ?').run(
                normalizedGroupId,
                profileId
            );
        }
    }

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
    if (set_music !== undefined) {
        const val = set_music ? 1 : 0;
        db.prepare('UPDATE profiles SET set_music = ? WHERE id = ?').run(val, profileId);
    }
    if (auto_increment_schedule !== undefined) {
        const val = auto_increment_schedule ? 1 : 0;
        db.prepare('UPDATE profiles SET auto_increment_schedule = ? WHERE id = ?').run(val, profileId);
    }
    if (upload_count !== undefined) {
        db.prepare('UPDATE profiles SET upload_count = ? WHERE id = ?').run(upload_count, profileId);
    }
    res.json({ success: true });
});

app.get('/api/groups', (req, res) => {
    try {
        res.json(listGroups(db));
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});

app.post('/api/groups', (req, res) => {
    try {
        const rawId = req.body.id;
        const id =
            typeof rawId === 'string' && rawId.trim() !== ''
                ? rawId.trim()
                : randomUUID();
        createGroup(db, { id, name: req.body.name });
        res.json({ success: true, id });
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});

app.patch('/api/groups/:id', (req, res) => {
    try {
        renameGroup(db, { id: req.params.id, name: req.body.name });
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});

app.delete('/api/groups/:id', (req, res) => {
    try {
        deleteGroup(db, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});

app.get('/api/profiles/:id/schedules', (req, res) => {
    try {
        const schedules = db.prepare('SELECT time FROM profile_schedules WHERE profile_id = ? ORDER BY time ASC').all(req.params.id);
        res.json(schedules.map(s => s.time));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profiles/:id/schedules', (req, res) => {
    const { times } = req.body; // Array of "HH:mm"
    if (!Array.isArray(times)) return res.status(400).json({ error: 'times must be an array' });

    try {
        db.transaction(() => {
            db.prepare('DELETE FROM profile_schedules WHERE profile_id = ?').run(req.params.id);
            const insert = db.prepare('INSERT INTO profile_schedules (profile_id, time) VALUES (?, ?)');
            for (const time of times) {
                if (/^\d{2}:\d{2}$/.test(time)) {
                    insert.run(req.params.id, time);
                }
            }
        })();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
        script = `powershell -Command "$app = New-Object -ComObject Shell.Application; $folder = $app.BrowseForFolder(0, 'Select Folder', 64); if ($folder) { $folder.Self.Path }"`;
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
const engagingProfiles = new Map(); // profileId -> { browser, stop: boolean }


app.post('/api/start', async (req, res) => {
    const { profileId, profileIds, runMode } = req.body;

    if (profileId) {
        const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (runningProfiles.has(profileId)) return res.status(400).json({ error: 'Profile already running' });

        runSingleProfile(profile);
        return res.json({ status: 'started', profile: profile.name });
    } else {
        const allRows = db.prepare('SELECT * FROM profiles').all();
        let profiles = allRows;
        if (Array.isArray(profileIds) && profileIds.length > 0) {
            const byId = new Map(allRows.map((p) => [String(p.id), p]));
            profiles = profileIds.map((id) => byId.get(String(id))).filter(Boolean);
            if (profiles.length === 0) {
                return res.status(400).json({ error: 'No matching profiles for the given selection' });
            }
        }
        const idleProfiles = profiles.filter((p) => !runningProfiles.has(p.id));
        if (idleProfiles.length === 0) {
            return res.status(400).json({
                error:
                    Array.isArray(profileIds) && profileIds.length > 0
                        ? 'No idle profiles in selection (they may already be running)'
                        : 'No idle profiles'
            });
        }

        const mode = runMode === 'sequential' ? 'sequential' : 'parallel';
        if (mode === 'sequential') {
            runAllSequential(idleProfiles).catch((err) => console.error('Sequential execution error:', err));
        } else {
            runAllParallel(idleProfiles);
        }
        return res.json({ status: 'started', count: idleProfiles.length, runMode: mode });
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

        if (profile.proxy) {
            const proxyConfig = parseProxy(profile.proxy);
            if (proxyConfig) {
                browserOptions.proxy = proxyConfig;
                console.log(`[${profile.name}] Using proxy: ${proxyConfig.server}${proxyConfig.username ? ' (with auth)' : ''}`);
            }
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

async function runAllSequential(profilesToRun) {
    for (const profile of profilesToRun) {
        if (runningProfiles.has(profile.id)) continue;
        await runSingleProfile(profile);
    }
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
    
    // Bypassing 'readonly' attribute to allow filling
    await input.evaluate(el => el.removeAttribute('readonly')).catch(() => null);
    
    await input.click({ clickCount: 3 });
    await page.waitForTimeout(500);

    // Special handling for the TikTok Time Picker
    if (label === 'Time') {
        const pickerSelector = '.tiktok-timepicker-time-picker-container';
        const picker = page.locator(pickerSelector);
        
        try {
            if (await picker.isVisible({ timeout: 2000 })) {
                log(`Time picker detected. Selecting items directly...`);
                const [targetHour, targetMinute] = value.split(':');
                
                const hourEl = picker.locator(`.tiktok-timepicker-left:has-text("${targetHour}")`).first();
                if (await hourEl.isVisible()) await hourEl.click({ force: true });

                const minuteEl = picker.locator(`.tiktok-timepicker-right:has-text("${targetMinute}")`).first();
                if (await minuteEl.isVisible()) await minuteEl.click({ force: true });

                await input.click();
                await page.waitForTimeout(500);
                return;
            }
        } catch (e) {
            log(`Time picker interaction failed: ${e.message}. Falling back to fill.`);
        }
    }

    await input.fill('');
    await input.type(value, { delay: 50 });
    await input.press('Enter').catch(() => null);
    await input.press('Tab').catch(() => null);
    await page.waitForTimeout(1000);

    const actualValue = await input.inputValue().catch(() => '');
    log(`${label} input value after fill: ${actualValue || '<empty>'}`);
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

    if (profile.proxy) {
        const proxyConfig = parseProxy(profile.proxy);
        if (proxyConfig) {
            browserOptions.proxy = proxyConfig;
            console.log(`[${profile.name}] Using proxy: ${proxyConfig.server}${proxyConfig.username ? ' (with auth)' : ''}`);
        }
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

        const maxUploads = (profile.is_scheduled === 1 && profile.upload_count > 0) 
            ? profile.upload_count 
            : videos.length;
        const uploadLimit = Math.min(videos.length, maxUploads);

        for (let i = 0; i < uploadLimit; i++) {
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

                const useSetMusic = Number(profile.set_music) === 1;
                if (!useSetMusic) {
                    log(`set_music tắt: bỏ qua Edit video và chọn nhạc.`);
                } else {
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
                }
            } catch (e) {
                log(`New tasks failed: ${e.message}`);
                await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_task_fail.png`) }).catch(() => null);
            }
            // --- END NEW TASKS ---

            // --- TASK 3: Scheduled Publishing ---
            if (profile.auto_increment_schedule) {
                try {
                    log(`Auto-increment schedule: processing video ${i + 1}...`);
                    if (i === 0) {
                        log(`Video 1: Posting immediately (Public).`);
                        // Public is usually default, but we can ensure it if needed
                    } else {
                        // 1. Click "Schedule" radio
                        const scheduleRadio = 'input[value="schedule"]';
                        const scheduleRadioInput = page.locator(scheduleRadio).first();
                        await scheduleRadioInput.waitFor({ timeout: 15000, state: 'attached' });
                        await scheduleRadioInput.check({ force: true }).catch(() => scheduleRadioInput.click({ force: true }));
                        log(`Selected "Schedule" option.`);
                        await page.waitForTimeout(3000);

                        // 2. Resolve inputs
                        const scheduleInputs = await resolveScheduleInputs(page, log);

                        if (i === 1) {
                            // Video 2: Capture TikTok's default time
                            const defaultDate = await page.locator('input.TUXTextInputCore-input:visible').nth(scheduleInputs.date.index).inputValue();
                            const defaultTime = await page.locator('input.TUXTextInputCore-input:visible').nth(scheduleInputs.time.index).inputValue();
                            log(`TikTok default schedule: ${defaultDate} ${defaultTime}`);
                            
                            lastScheduledTime = parseScheduleValue(defaultDate, defaultTime);
                            if (lastScheduledTime) {
                                log(`Captured base time: ${lastScheduledTime.toISOString()}`);
                            } else {
                                log(`Warning: Failed to parse default time. Using fallback.`);
                                lastScheduledTime = computeAutoIncrementTime({ lastScheduledTime: null, now: new Date() });
                            }
                        } else {
                            // Video 3+: Increment by 5 minutes
                            lastScheduledTime = computeAutoIncrementTime({ lastScheduledTime });
                            const dateValue = formatScheduleValue(lastScheduledTime, 'date', scheduleInputs.date || {});
                            const timeValue = formatScheduleValue(lastScheduledTime, 'time', scheduleInputs.time || {});
                            
                            log(`Setting incremented schedule: ${dateValue} ${timeValue}`);
                            await fillScheduleInput(page, scheduleInputs.date, dateValue, 'Date', log);
                            await fillScheduleInput(page, scheduleInputs.time, timeValue, 'Time', log);
                            await page.waitForTimeout(2000);
                        }
                        
                        await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_autoincrement_${i+1}.png`) }).catch(() => null);
                    }
                } catch (e) {
                    log(`Auto-increment scheduling failed: ${e.message}`);
                }
            } else if (profile.is_scheduled && i >= 3) {
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

                // Navigate back to upload page for next video if not last
                if (i < videos.length - 1) {
                    log(`Preparing for next video...`);
                    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' }).catch(() => null);
                    await page.waitForTimeout(5000);
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

// =============================================
// AUTO ENGAGE FEATURE
// =============================================

// Comment templates để khen video (mix Anh-Việt tự nhiên)
const ENGAGE_COMMENTS = [
    '🔥🔥🔥',
    'This is so good!',
    'Love this content! 💯',
    'Amazing! Keep it up! 👏',
    'Bro really said no days off 💪',
    'This made my day fr fr',
    'Goated content right here 🐐',
    'W video no cap',
    'You never miss 🎯',
    'So underrated omg',
    'POV: quality content',
    'Nailed it! 🙌',
    'Literally obsessed with this 😍',
    'Bro ate that up 🔥',
    'Not me watching this 10 times',
    'Câu này hay quá 🤩',
    'Video hay vl 😭❤️',
    'Content creator xịn sò 👑',
    'Ủa hay v trời 🔥',
    'Xem đi xem lại không chán',
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// POST /api/engage — Bắt đầu auto engage session
app.post('/api/engage', async (req, res) => {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (runningProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently running upload automation' });
    }
    if (engagingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is already engaging' });
    }

    // Start engage session in background
    runEngageSession(profile).catch(err =>
        console.error(`[${profile.name}] Engage session error:`, err)
    );

    res.json({ status: 'started', profile: profile.name });
});

// POST /api/engage/stop — Dừng auto engage session
app.post('/api/engage/stop', async (req, res) => {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    const session = engagingProfiles.get(profileId);
    if (!session) {
        return res.status(400).json({ error: 'Profile is not currently engaging' });
    }

    // Signal stop
    session.stop = true;
    res.json({ status: 'stopping', message: 'Engage session will stop shortly' });
});

// GET /api/engage/status/:profileId — Kiểm tra trạng thái engage
app.get('/api/engage/status/:profileId', (req, res) => {
    const profileId = req.params.profileId;
    const session = engagingProfiles.get(profileId);
    res.json({
        engaging: !!session,
        stats: session ? session.stats : null
    });
});

async function runEngageSession(profile) {
    const profileId = profile.id;
    const userDataDir = path.join(PROFILES_DIR, profile.name);

    const log = (msg) => {
        const entry = `[${new Date().toISOString()}] [${profile.name}][ENGAGE] ${msg}\n`;
        console.log(entry.trim());
        try {
            fs.appendFileSync(path.join(__dirname, 'automation.log'), entry);
        } catch (e) {}
    };

    const browserOptions = {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    };

    if (profile.proxy) {
        const proxyConfig = parseProxy(profile.proxy);
        if (proxyConfig) {
            browserOptions.proxy = proxyConfig;
            log(`Using proxy: ${proxyConfig.server}`);
        }
    }

    const browser = await chromium.launchPersistentContext(userDataDir, browserOptions);

    const session = { browser, stop: false, stats: { videosWatched: 0, likes: 0, comments: 0, channelVisits: 0 } };
    engagingProfiles.set(profileId, session);
    db.prepare("UPDATE profiles SET status = ? WHERE id = ?").run('engaging', profileId);

    log('Engage session started');

    try {
        const page = await browser.newPage();

        // Điều hướng đến trang For You
        await page.goto('https://www.tiktok.com/foryou', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        await page.waitForTimeout(3000);

        // Dismiss any initial popups/login prompts
        await engageDismissPopups(page, log);

        let videosSinceLastChannelVisit = 0;
        let nextChannelVisitAt = randomInt(10, 15);

        while (!session.stop) {
            try {
                // === BƯỚC 1: Xem video hiện tại ===
                const watchTime = randomInt(10000, 30000); // 10–30 giây (ms)
                log(`Watching video for ${(watchTime / 1000).toFixed(1)}s...`);

                // Chia watch time thành nhiều đoạn nhỏ để check stop signal
                const checkInterval = 2000;
                let elapsed = 0;
                while (elapsed < watchTime && !session.stop) {
                    await page.waitForTimeout(Math.min(checkInterval, watchTime - elapsed));
                    elapsed += checkInterval;
                }

                if (session.stop) break;

                session.stats.videosWatched++;
                videosSinceLastChannelVisit++;

                // === BƯỚC 2: Like (xác suất ~15%) ===
                if (Math.random() < 0.15) {
                    try {
                        await engageLike(page, log);
                        session.stats.likes++;
                    } catch (e) {
                        log(`Like failed: ${e.message}`);
                    }
                    await page.waitForTimeout(randomInt(800, 1500));
                }

                // === BƯỚC 3: Comment (xác suất ~5%) ===
                if (!session.stop && Math.random() < 0.05) {
                    try {
                        await engageComment(page, log);
                        session.stats.comments++;
                    } catch (e) {
                        log(`Comment failed: ${e.message}`);
                    }
                    await page.waitForTimeout(randomInt(1000, 2000));
                }

                if (session.stop) break;

                // === BƯỚC 4: Visit channel sau mỗi 10–15 video ===
                if (videosSinceLastChannelVisit >= nextChannelVisitAt) {
                    try {
                        log(`Visiting creator channel (after ${videosSinceLastChannelVisit} videos)...`);
                        const visited = await engageVisitChannel(page, session, log);
                        if (visited) {
                            session.stats.channelVisits++;
                        }
                    } catch (e) {
                        log(`Channel visit failed: ${e.message}`);
                    }

                    // Reset counter
                    videosSinceLastChannelVisit = 0;
                    nextChannelVisitAt = randomInt(10, 15);

                    if (session.stop) break;

                    // Quay lại trang chủ
                    log('Returning to For You page...');
                    await page.goto('https://www.tiktok.com/foryou', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
                    await page.waitForTimeout(randomInt(2000, 4000));
                    await engageDismissPopups(page, log);
                } else {
                    // === BƯỚC 5: Scroll xuống video tiếp theo ===
                    if (!session.stop) {
                        await engageScrollToNext(page, log);
                        await page.waitForTimeout(randomInt(1000, 2000));
                    }
                }

                log(`Stats: watched=${session.stats.videosWatched}, likes=${session.stats.likes}, comments=${session.stats.comments}, channels=${session.stats.channelVisits}`);

            } catch (loopErr) {
                log(`Loop error (continuing): ${loopErr.message}`);
                await page.waitForTimeout(3000);
                // Cố gắng quay về For You nếu bị lạc
                await page.goto('https://www.tiktok.com/foryou', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
                await page.waitForTimeout(2000);
            }
        }

        log(`Engage session stopped. Final stats: ${JSON.stringify(session.stats)}`);

    } catch (err) {
        log(`Session critical error: ${err.message}`);
    } finally {
        engagingProfiles.delete(profileId);
        await browser.close().catch(() => null);
        db.prepare("UPDATE profiles SET status = 'idle' WHERE id = ?").run(profileId);
        log('Engage session ended, browser closed.');
    }
}

// Like video hiện tại
async function engageLike(page, log) {
    const likeSelectors = [
        '[data-e2e="like-icon"]',
        'button[aria-label*="like" i]:not([aria-label*="comment" i])',
        '[class*="LikeIcon"]',
        'span[class*="like"] svg',
    ];

    for (const sel of likeSelectors) {
        try {
            const el = await page.$(sel);
            if (el && await el.isVisible()) {
                // Kiểm tra xem đã like chưa (tránh unlike)
                const isLiked = await el.evaluate(node => {
                    const btn = node.closest('button') || node;
                    return btn.getAttribute('aria-pressed') === 'true'
                        || btn.classList.toString().includes('active')
                        || btn.classList.toString().includes('liked');
                }).catch(() => false);

                if (!isLiked) {
                    await el.click({ force: true });
                    log(`Liked video via ${sel}`);
                    return true;
                } else {
                    log(`Video already liked, skipping`);
                    return false;
                }
            }
        } catch (e) {}
    }
    log(`Like button not found`);
    return false;
}

// Comment vào video hiện tại
async function engageComment(page, log) {
    const comment = randomItem(ENGAGE_COMMENTS);

    // Mở comment box
    const commentBtnSelectors = [
        '[data-e2e="comment-icon"]',
        'button[aria-label*="comment" i]',
        '[class*="CommentIcon"]',
    ];

    let opened = false;
    for (const sel of commentBtnSelectors) {
        try {
            const el = await page.$(sel);
            if (el && await el.isVisible()) {
                await el.click({ force: true });
                opened = true;
                log(`Opened comment box via ${sel}`);
                break;
            }
        } catch (e) {}
    }

    if (!opened) {
        log('Could not open comment box');
        return false;
    }

    await page.waitForTimeout(1500);

    // Tìm input box comment
    const inputSelectors = [
        '[data-e2e="comment-input"]',
        'div[contenteditable="true"][placeholder*="comment" i]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="comment" i]',
    ];

    for (const sel of inputSelectors) {
        try {
            const input = await page.waitForSelector(sel, { timeout: 5000, state: 'visible' }).catch(() => null);
            if (input) {
                await input.click();
                await page.waitForTimeout(500);
                await page.keyboard.type(comment, { delay: randomInt(50, 120) });
                await page.waitForTimeout(randomInt(500, 1000));

                // Submit comment
                await page.keyboard.press('Enter');
                log(`Commented: "${comment}"`);
                await page.waitForTimeout(1000);

                // Đóng comment panel bằng ESC hoặc click ngoài
                await page.keyboard.press('Escape');
                return true;
            }
        } catch (e) {}
    }

    log('Comment input not found, pressing Escape to close');
    await page.keyboard.press('Escape');
    return false;
}

// Visit kênh của creator video hiện tại, xem 1–3 video rồi quay về
async function engageVisitChannel(page, session, log) {
    // Click vào tên/avatar creator
    const creatorSelectors = [
        '[data-e2e="video-author-uniqueid"]',
        'a[href*="/@"]',
        '[class*="AuthorTitle"] a',
        '[class*="author-uniqueId"] a',
        'h3[class*="AuthorUniqueId"] a',
    ];

    let channelUrl = null;
    for (const sel of creatorSelectors) {
        try {
            const el = await page.$(sel);
            if (el && await el.isVisible()) {
                const href = await el.getAttribute('href').catch(() => null);
                if (href && href.includes('/@')) {
                    channelUrl = href.startsWith('http') ? href : `https://www.tiktok.com${href}`;
                    log(`Found creator link: ${channelUrl}`);
                    break;
                }
            }
        } catch (e) {}
    }

    if (!channelUrl) {
        log('Creator link not found, skipping channel visit');
        return false;
    }

    // Điều hướng đến kênh
    await page.goto(channelUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(randomInt(2000, 3500));
    await engageDismissPopups(page, log);

    if (session.stop) return true;

    // Tìm danh sách video trên kênh và click vào 1–3 video ngẫu nhiên
    const numVideosToWatch = randomInt(1, 3);
    log(`Will watch ${numVideosToWatch} video(s) on this channel`);

    const videoLinkSelectors = [
        '[data-e2e="user-post-item"] a',
        'div[class*="DivWrapper"] a[href*="/video/"]',
        'a[href*="/video/"]',
    ];

    let videoLinks = [];
    for (const sel of videoLinkSelectors) {
        try {
            const els = await page.$$(sel);
            if (els.length > 0) {
                // Lấy href của từng video
                const hrefs = [];
                for (const el of els.slice(0, 12)) {
                    const href = await el.getAttribute('href').catch(() => null);
                    if (href && href.includes('/video/')) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.tiktok.com${href}`;
                        if (!hrefs.includes(fullUrl)) hrefs.push(fullUrl);
                    }
                }
                if (hrefs.length > 0) {
                    videoLinks = hrefs;
                    break;
                }
            }
        } catch (e) {}
    }

    if (videoLinks.length === 0) {
        log('No video links found on channel, returning');
        return true;
    }

    // Chọn ngẫu nhiên các video để xem
    const shuffled = videoLinks.sort(() => Math.random() - 0.5);
    const toWatch = shuffled.slice(0, Math.min(numVideosToWatch, shuffled.length));

    for (const videoUrl of toWatch) {
        if (session.stop) break;

        try {
            log(`Watching channel video: ${videoUrl}`);
            await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
            await page.waitForTimeout(randomInt(2000, 3000));
            await engageDismissPopups(page, log);

            // Xem video 10–25 giây
            const watchTime = randomInt(10000, 25000);
            log(`Watching for ${(watchTime / 1000).toFixed(1)}s...`);

            let elapsed = 0;
            const checkInterval = 2000;
            while (elapsed < watchTime && !session.stop) {
                await page.waitForTimeout(Math.min(checkInterval, watchTime - elapsed));
                elapsed += checkInterval;
            }

            session.stats.videosWatched++;

            // Like với xác suất 20% (cao hơn khi đang trong kênh)
            if (!session.stop && Math.random() < 0.20) {
                try {
                    await engageLike(page, log);
                    session.stats.likes++;
                } catch (e) {}
            }

        } catch (e) {
            log(`Error watching channel video: ${e.message}`);
        }

        await page.waitForTimeout(randomInt(1000, 2000));
    }

    return true;
}

// Scroll xuống video tiếp theo trên For You page
async function engageScrollToNext(page, log) {
    try {
        // Phương án 1: Nhấn phím mũi tên xuống
        await page.keyboard.press('ArrowDown');
        log('Scrolled to next video (ArrowDown)');
        return;
    } catch (e) {}

    try {
        // Phương án 2: Scroll chuột
        await page.mouse.wheel(0, 800);
        log('Scrolled to next video (wheel)');
    } catch (e) {
        log(`Scroll failed: ${e.message}`);
    }
}

// Dismiss popup nhẹ nhàng (phiên bản cho engage — không dùng lại dismissPopups upload)
async function engageDismissPopups(page, log) {
    const dismissSelectors = [
        'button:has-text("Log in later")',
        'button:has-text("Not now")',
        'button:has-text("Skip")',
        'button:has-text("Got it")',
        'button:has-text("Allow")',
        '[aria-label="Close"]',
        'button[class*="close" i]',
    ];
    for (const sel of dismissSelectors) {
        try {
            const el = await page.$(sel);
            if (el && await el.isVisible()) {
                await el.click();
                log(`Dismissed popup: ${sel}`);
                await page.waitForTimeout(500);
            }
        } catch (e) {}
    }
}

// =============================================
// END AUTO ENGAGE FEATURE
// =============================================

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

// Background Scheduler
function checkAndRunSchedules() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    try {
        // Find all profiles that have a schedule matching the current time
        const scheduledProfiles = db.prepare(`
            SELECT DISTINCT p.* 
            FROM profiles p
            JOIN profile_schedules ps ON p.id = ps.profile_id
            WHERE ps.time = ?
        `).all(currentTime);

        if (scheduledProfiles.length > 0) {
            console.log(`[Scheduler] Found ${scheduledProfiles.length} profiles to run at ${currentTime}`);
            scheduledProfiles.forEach(profile => {
                if (!runningProfiles.has(profile.id)) {
                    console.log(`[Scheduler] Triggering automation for: ${profile.name}`);
                    runSingleProfile(profile).catch(err => console.error(`[Scheduler] Error running ${profile.name}:`, err));
                } else {
                    console.log(`[Scheduler] Profile ${profile.name} is already running, skipping scheduled trigger.`);
                }
            });
        }
    } catch (err) {
        console.error('[Scheduler] Database error:', err);
    }
}

// Run every minute (offset by a few seconds to avoid missing the boundary if execution is slow)
setInterval(checkAndRunSchedules, 60000);

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
