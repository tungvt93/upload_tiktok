import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { exec, spawn } from 'child_process';
import axios from 'axios';
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
const PORT = 3010;

app.use(cors());
app.use(express.json());

// Catch unhandled exceptions and promise rejections to prevent Playwright abrupt closures from crashing the server
process.on('uncaughtException', (err) => {
    console.error('[System] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[System] Unhandled Rejection at:', promise, 'reason:', reason);
});

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
// Migration: channel_ids — Danh sách ID channel quản lý (cách nhau bằng dấu ,)
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasChannelIds = tableInfo.some((col) => col.name === 'channel_ids');
    if (!hasChannelIds) {
        db.exec('ALTER TABLE profiles ADD COLUMN channel_ids TEXT;');
        console.log('Added channel_ids column to profiles table');
    }
} catch (err) {
    console.error('Migration error (channel_ids column):', err);
}

// Migration: needs_render — Xác định profile này có cần render video bypass không
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasNeedsRender = tableInfo.some((col) => col.name === 'needs_render');
    if (!hasNeedsRender) {
        db.exec('ALTER TABLE profiles ADD COLUMN needs_render INTEGER DEFAULT 1;');
        console.log('Added needs_render column to profiles table');
    }
} catch (err) {
    console.error('Migration error (needs_render column):', err);
}

// Migration: remove_title — Xác định profile này có xóa tiêu đề mặc định khi upload không
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasRemoveTitle = tableInfo.some((col) => col.name === 'remove_title');
    if (!hasRemoveTitle) {
        db.exec('ALTER TABLE profiles ADD COLUMN remove_title INTEGER DEFAULT 1;');
        console.log('Added remove_title column to profiles table with default 1');
    }
} catch (err) {
    console.error('Migration error (remove_title column):', err);
}

// Migration: need_content_check — Xác định profile này có cần check content không
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasNeedContentCheck = tableInfo.some((col) => col.name === 'need_content_check');
    if (!hasNeedContentCheck) {
        db.exec('ALTER TABLE profiles ADD COLUMN need_content_check INTEGER DEFAULT 1;');
        console.log('Added need_content_check column to profiles table with default 1');
    }
} catch (err) {
    console.error('Migration error (need_content_check column):', err);
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

    // Strip trailing slash if present to avoid Chromium proxy authentication issues
    if (server && server.endsWith('/')) {
        server = server.slice(0, -1);
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
    const { name, group_id, video_folder, channel_ids, need_content_check } = req.body;

    try {
        const id = Date.now().toString();
        const profile = createProfileRecord(db, {
            id,
            name,
            group_id,
            video_folder,
            channel_ids,
            need_content_check
        });
        res.json(profile);
    } catch (err) {
        res.status(err.status || 400).json({
            error: err.message || 'Profile already exists or database error'
        });
    }
});

app.delete('/api/profiles/:id', (req, res) => {
    const profileId = req.params.id;
    try {
        // 1. Get profile info before deleting from DB
        const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
        
        if (profile) {
            console.log(`[System] Deleting profile ${profile.name}...`);

            // 2. Delete browser profile folder
            const profileFolder = path.join(PROFILES_DIR, profile.name);
            if (fs.existsSync(profileFolder) && profileFolder !== PROFILES_DIR && profile.name.length > 0) {
                try {
                    fs.rmSync(profileFolder, { recursive: true, force: true });
                    console.log(`[System] Deleted browser profile folder: ${profileFolder}`);
                } catch (err) {
                    console.error(`[System] Error deleting browser profile folder: ${err.message}`);
                }
            }

            // 3. Delete video upload folder (from DB field)
            const videoFolder = profile.video_folder;
            if (videoFolder && fs.existsSync(videoFolder) && videoFolder !== UPLOADS_DIR && videoFolder.length > 5) {
                try {
                    fs.rmSync(videoFolder, { recursive: true, force: true });
                    console.log(`[System] Deleted video upload folder from DB: ${videoFolder}`);
                } catch (err) {
                    console.error(`[System] Error deleting video folder from DB: ${err.message}`);
                }
            }

            // 4. Also delete folder in uploads matching profile name (if it exists)
            const uploadsProfileFolder = path.join(UPLOADS_DIR, profile.name);
            if (fs.existsSync(uploadsProfileFolder) && uploadsProfileFolder !== UPLOADS_DIR && profile.name.length > 0) {
                try {
                    fs.rmSync(uploadsProfileFolder, { recursive: true, force: true });
                    console.log(`[System] Deleted video upload folder matching profile name: ${uploadsProfileFolder}`);
                } catch (err) {
                    console.error(`[System] Error deleting video upload folder matching profile name: ${err.message}`);
                }
            }

            // 5. Also delete folder in uploads matching normalized/lowercase profile name (if it exists)
            const normalizedName = profile.name.toLowerCase().replace(/\s+/g, '');
            if (normalizedName) {
                const uploadsNormalizedFolder = path.join(UPLOADS_DIR, normalizedName);
                if (fs.existsSync(uploadsNormalizedFolder) && uploadsNormalizedFolder !== UPLOADS_DIR && normalizedName.length > 0) {
                    try {
                        fs.rmSync(uploadsNormalizedFolder, { recursive: true, force: true });
                        console.log(`[System] Deleted video upload folder matching normalized name: ${uploadsNormalizedFolder}`);
                    } catch (err) {
                        console.error(`[System] Error deleting video upload folder matching normalized name: ${err.message}`);
                    }
                }
            }
        }

        // 4. Delete from Database
        db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
        res.json({ success: true });
    } catch (err) {
        console.error(`[System] Error during profile deletion: ${err.message}`);
        res.status(500).json({ error: `Failed to delete profile: ${err.message}` });
    }
});

app.patch('/api/profiles/:id', (req, res) => {
    const { name, video_folder, proxy, is_scheduled, auto_increment_schedule, set_music, upload_count, channel_ids, needs_render, remove_title, need_content_check } = req.body;
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
    if (channel_ids !== undefined) {
        db.prepare('UPDATE profiles SET channel_ids = ? WHERE id = ?').run(channel_ids, profileId);
    }
    if (needs_render !== undefined) {
        const val = needs_render ? 1 : 0;
        db.prepare('UPDATE profiles SET needs_render = ? WHERE id = ?').run(val, profileId);
    }
    if (remove_title !== undefined) {
        const val = remove_title ? 1 : 0;
        db.prepare('UPDATE profiles SET remove_title = ? WHERE id = ?').run(val, profileId);
    }
    if (need_content_check !== undefined) {
        const val = need_content_check ? 1 : 0;
        db.prepare('UPDATE profiles SET need_content_check = ? WHERE id = ?').run(val, profileId);
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

function sanitizeToAscii(str) {
    if (!str) return '';
    // Normalize to decompose combined graphemes (removes Vietnamese accents)
    let sanitized = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Replace custom letters like đ, Đ
    sanitized = sanitized.replace(/đ/g, 'd').replace(/Đ/g, 'D');
    // Keep only letters, digits, spaces, hyphens, and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_]/g, '');
    // Clean spaces
    sanitized = sanitized.trim().replace(/\s+/g, ' ');
    return sanitized;
}

// Automation state - must be declared before any endpoint that uses them
const runningProfiles = new Set();
const processingProfiles = new Set();
const processingVideoIds = new Map(); // video_id -> profile.id currently processing that video
const manualBrowsers = new Map(); // profileId -> browserContext
const engagingProfiles = new Map(); // profileId -> { browser, stop: boolean }

app.post('/api/upload_new_video', async (req, res) => {
    const { video_id, channel_id } = req.body;

    if (!video_id || !channel_id) {
        return res.status(400).json({ error: 'Both video_id and channel_id are required' });
    }

    // Find profile that manages this channel_id
    const profiles = db.prepare('SELECT * FROM profiles').all();
    const profile = profiles.find(p => {
        if (!p.channel_ids) return false;
        const ids = p.channel_ids.split(',').map(id => id.trim());
        return ids.includes(channel_id.trim());
    });

    if (!profile) {
        return res.status(404).json({ error: `No profile found managing channel ID: ${channel_id}` });
    }

    // Lock 1: Check if this exact video_id is already being processed
    if (processingVideoIds.has(video_id)) {
        console.log(`[${profile.name}] Duplicate request: video_id=${video_id} is already being processed.`);
        return res.status(400).json({ error: `Video ID '${video_id}' is already being processed. Please wait.` });
    }

    // Lock 2: Check if profile is already running automation or processing another video
    if (runningProfiles.has(profile.id) || processingProfiles.has(profile.id)) {
        return res.status(400).json({ error: `Profile '${profile.name}' is already running automation or processing a video` });
    }

    // Acquire both locks immediately
    processingVideoIds.set(video_id, profile.id);
    processingProfiles.add(profile.id);

    let downloadedFilePath = null;

    try {
        // Determine destination folder
        const videoFolder = profile.video_folder || getConfig('videoFolder', UPLOADS_DIR);
        if (!fs.existsSync(videoFolder)) {
            fs.mkdirSync(videoFolder, { recursive: true });
        }

        // Ensure backgrounds folder exists
        const backgroundsFolder = path.join(__dirname, 'backgrounds');
        if (!fs.existsSync(backgroundsFolder)) {
            fs.mkdirSync(backgroundsFolder, { recursive: true });
        }

        // 1. Resolve the correct URL and Get Title
        let targetUrl = `https://youtube.com/shorts/${video_id}`;
        console.log(`[${profile.name}] Checking if video is a Short: ${targetUrl}`);
        
        let originalTitle = await new Promise((resolve) => {
            const child = spawn('yt-dlp', ['--get-title', '--no-playlist', targetUrl]);
            let titleData = '';
            child.stdout.on('data', (data) => { titleData += data.toString(); });
            child.on('close', (code) => {
                if (code === 0 && titleData.trim()) resolve(titleData.trim());
                else resolve(null);
            });
            child.on('error', () => resolve(null));
        });

        if (!originalTitle) {
            // Fallback to long format
            targetUrl = `https://youtube.com/watch?v=${video_id}`;
            console.log(`[${profile.name}] Short not found. Falling back to Long video format: ${targetUrl}`);
            
            originalTitle = await new Promise((resolve) => {
                const child = spawn('yt-dlp', ['--get-title', '--no-playlist', targetUrl]);
                let titleData = '';
                child.stdout.on('data', (data) => { titleData += data.toString(); });
                child.on('close', (code) => {
                    if (code === 0 && titleData.trim()) resolve(titleData.trim());
                    else resolve('video');
                });
                child.on('error', () => resolve('video'));
            });
        }

        console.log(`[${profile.name}] Original title retrieved: "${originalTitle}"`);
        const cleanTitle = sanitizeToAscii(originalTitle).substring(0, 80);
        const fileNameBase = cleanTitle || 'video';

        // Generate a 100% safe, clean ASCII filename containing original title
        const safeFileName = `${fileNameBase}_${Date.now()}_${randomUUID().slice(0, 8)}.mp4`;
        downloadedFilePath = path.join(videoFolder, safeFileName);

        console.log(`[${profile.name}] Starting yt-dlp download from: ${targetUrl} to: ${downloadedFilePath}`);

        // Download video using yt-dlp command line
        const downloadArgs = [
            targetUrl,
            '-o', downloadedFilePath,
            '-f', 'bestvideo[height<=1080]+bestaudio/best/best',
            '--merge-output-format', 'mp4',
            '--no-playlist'
        ];

        await new Promise((resolve, reject) => {
            const child = spawn('yt-dlp', downloadArgs);
            let stderrData = '';
            child.stderr.on('data', (data) => { stderrData += data.toString(); });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`yt-dlp exited with code ${code}. Stderr: ${stderrData}`));
            });
            child.on('error', (err) => { child.kill(); reject(err); });
        });

        console.log(`[${profile.name}] Video download complete via yt-dlp.`);

        // Check video duration - skip if less than 5 seconds
        let videoDuration = await new Promise((resolve) => {
            const ffprobe = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                downloadedFilePath
            ]);
            let output = '';
            ffprobe.stdout.on('data', (data) => output += data.toString());
            ffprobe.on('close', () => {
                const dur = parseFloat(output.trim());
                resolve(isNaN(dur) ? 0 : dur);
            });
            ffprobe.on('error', () => resolve(0));
        });

        console.log(`[${profile.name}] Video duration: ${videoDuration.toFixed(2)}s`);

        // If the video is close to 5 seconds (between 2.0s and 5.0s), slow it down to be > 5s
        if (videoDuration >= 2.0 && videoDuration < 5.0) {
            const targetDuration = 5.2;
            const speedFactor = videoDuration / targetDuration;
            console.log(`[${profile.name}] Video is close to 5s (${videoDuration.toFixed(2)}s). Slowing down by factor ${speedFactor.toFixed(3)} to exceed 5s.`);
            
            const slowedFilePath = downloadedFilePath.replace('.mp4', '_slowed.mp4');

            // Check if there is an audio stream to avoid mapping errors in ffmpeg
            const hasAudio = await new Promise((resolve) => {
                const ffprobe = spawn('ffprobe', [
                    '-v', 'error',
                    '-select_streams', 'a',
                    '-show_entries', 'stream=codec_type',
                    '-of', 'csv=p=0',
                    downloadedFilePath
                ]);
                let output = '';
                ffprobe.stdout.on('data', (data) => output += data.toString());
                ffprobe.on('close', () => resolve(output.trim() === 'audio'));
                ffprobe.on('error', () => resolve(false));
            });

            const ffmpegArgs = [
                '-y',
                '-i', downloadedFilePath,
                '-filter_complex', hasAudio ? `[0:v]setpts=PTS/${speedFactor}[v];[0:a]atempo=${speedFactor}[a]` : `[0:v]setpts=PTS/${speedFactor}[v]`,
                '-map', '[v]'
            ];
            if (hasAudio) ffmpegArgs.push('-map', '[a]');
            ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', slowedFilePath);

            try {
                await new Promise((resolve, reject) => {
                    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
                    ffmpegProcess.on('close', (code) => {
                        if (code === 0) resolve(true);
                        else reject(new Error(`ffmpeg exited with code ${code}`));
                    });
                    ffmpegProcess.on('error', (err) => reject(err));
                });
                if (fs.existsSync(downloadedFilePath)) fs.unlinkSync(downloadedFilePath);
                fs.renameSync(slowedFilePath, downloadedFilePath);
                console.log(`[${profile.name}] Successfully slowed down video to > 5s.`);
                
                // Re-measure the new video duration
                videoDuration = await new Promise((resolve) => {
                    const ffprobe = spawn('ffprobe', [
                        '-v', 'error',
                        '-show_entries', 'format=duration',
                        '-of', 'default=noprint_wrappers=1:nokey=1',
                        downloadedFilePath
                    ]);
                    let output = '';
                    ffprobe.stdout.on('data', (data) => output += data.toString());
                    ffprobe.on('close', () => {
                        const dur = parseFloat(output.trim());
                        resolve(isNaN(dur) ? 0 : dur);
                    });
                    ffprobe.on('error', () => resolve(0));
                });
                console.log(`[${profile.name}] New video duration after slow down: ${videoDuration.toFixed(2)}s`);
            } catch (err) {
                console.error(`[${profile.name}] Failed to slow down video:`, err.message);
                if (fs.existsSync(slowedFilePath)) {
                    try { fs.unlinkSync(slowedFilePath); } catch (e) {}
                }
            }
        }

        if (videoDuration < 5) {
            console.log(`[${profile.name}] Video too short (${videoDuration.toFixed(2)}s < 5s). Deleting and skipping.`);
            if (fs.existsSync(downloadedFilePath)) fs.unlinkSync(downloadedFilePath);
            return res.json({
                success: true,
                skipped: true,
                message: `Video quá ngắn (${videoDuration.toFixed(2)}s < 5s). Đã xóa và bỏ qua, không upload.`,
                duration: videoDuration
            });
        }

        // Check if render is needed based on profile configuration
        if (profile.needs_render !== 0) {
            const renderedFilePath = path.join(videoFolder, `rendered_${safeFileName}`);
            console.log(`[${profile.name}] Starting render pipeline via render.py: ${downloadedFilePath} -> ${renderedFilePath}`);

            const pythonBinary = process.platform === 'win32' ? 'python' : 'python3';
            const renderArgs = [
                path.join(__dirname, 'render.py'),
                '--video', downloadedFilePath,
                '--backgrounds', backgroundsFolder,
                '--output', renderedFilePath
            ];

            await new Promise((resolve, reject) => {
                const child = spawn(pythonBinary, renderArgs);
                let stdoutData = '';
                let stderrData = '';
                child.stdout.on('data', (data) => stdoutData += data.toString());
                child.stderr.on('data', (data) => stderrData += data.toString());
                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`render.py exited with code ${code}. Stderr: ${stderrData}`));
                });
                child.on('error', (err) => { child.kill(); reject(err); });
            });

            console.log(`[${profile.name}] Render complete. Replacing original downloaded video file...`);
            if (fs.existsSync(downloadedFilePath)) fs.unlinkSync(downloadedFilePath);
            fs.renameSync(renderedFilePath, downloadedFilePath);
            console.log(`[${profile.name}] Video fully replaced with bypass-rendered version.`);
        } else {
            console.log(`[${profile.name}] Bypass Render is enabled for this profile. Skipping render pipeline.`);
        }

        // Respond immediately before triggering the browser automation
        res.json({
            success: true,
            message: 'Video downloaded and processed. Upload automation starting...',
            profile: profile.name,
            profileId: profile.id,
            filePath: downloadedFilePath
        });

        // Trigger upload in background AFTER responding
        // processingProfiles lock is released only here - after download+render is fully done
        // runSingleProfile will manage runningProfiles internally
        runSingleProfile(profile);

    } catch (error) {
        console.error('Error in /api/upload_new_video:', error.message);
        // Clean up partially downloaded file if it exists
        if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
            try { fs.unlinkSync(downloadedFilePath); } catch (e) {}
        }
        // Only send error response if headers not sent yet
        if (!res.headersSent) {
            res.status(500).json({ error: `Failed to process video: ${error.message}` });
        }
    } finally {
        // Always release both locks when download+render phase is done
        processingProfiles.delete(profile.id);
        processingVideoIds.delete(video_id);
        console.log(`[${profile.name}] Processing lock released for video_id=${video_id}`);
    }
});

// Automation Trigger (declarations moved to before /api/upload_new_video)


app.post('/api/start', async (req, res) => {
    const { profileId, profileIds, runMode, limitUploads, uploadLimitCount } = req.body;

    if (profileId) {
        const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (runningProfiles.has(profileId) || processingProfiles.has(profileId)) return res.status(400).json({ error: 'Profile already running or processing a video' });

        runSingleProfile(profile, !!limitUploads, Number(uploadLimitCount) || 0);
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
        const idleProfiles = profiles.filter((p) => !runningProfiles.has(p.id) && !processingProfiles.has(p.id));
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
            runAllSequential(idleProfiles, !!limitUploads, Number(uploadLimitCount) || 0).catch((err) => console.error('Sequential execution error:', err));
        } else {
            runAllParallel(idleProfiles, !!limitUploads, Number(uploadLimitCount) || 0);
        }
        return res.json({ status: 'started', count: idleProfiles.length, runMode: mode });
    }
});

app.post('/api/open-profile', async (req, res) => {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (runningProfiles.has(profileId) || processingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently running automation or processing a video' });
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


async function runAllParallel(profilesToRun, limitUploads = false, uploadLimitCount = 0) {
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
            const promise = runSingleProfile(profile, limitUploads, uploadLimitCount).finally(() => {
                active.splice(active.indexOf(promise), 1);
            });
            active.push(promise);
        }
        await Promise.all(active);
    }

    processQueue().catch(err => console.error('Parallel execution error:', err));
}

async function runAllSequential(profilesToRun, limitUploads = false, uploadLimitCount = 0) {
    for (const profile of profilesToRun) {
        if (runningProfiles.has(profile.id)) continue;
        await runSingleProfile(profile, limitUploads, uploadLimitCount);
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

    // Special handling for the TikTok Date Picker
    if (label === 'Date') {
        const pickerSelector = '.calendar-wrapper';
        try {
            // Click input once to open calendar if not already open
            if (!(await page.locator(pickerSelector).isVisible({ timeout: 500 }).catch(() => false))) {
                await input.click();
            }
            await page.waitForTimeout(1000);

            const picker = page.locator(pickerSelector).first();
            if (await picker.isVisible({ timeout: 3000 })) {
                log(`Calendar picker detected. Selecting day directly...`);

                // Parse the target day from value (expected YYYY-MM-DD or MM/DD/YYYY)
                const parts = value.split(/[-/.]/).map(Number);
                let targetDay = parts[2]; // Default for YYYY-MM-DD or YYYY.MM.DD
                if (value.includes('/') && parts[0] <= 12) targetDay = parts[1]; // MM/DD/YYYY
                else if (value.includes('/') && parts[0] > 12) targetDay = parts[0]; // DD/MM/YYYY

                log(`Extracted target day: ${targetDay}`);

                // Click the day span. Filter for 'valid' to stay in current month.
                // We use :text-is to match exact text and avoid "2" matching "22"
                const dayEl = picker.locator(`span.day.valid`).filter({ hasText: new RegExp(`^${targetDay}$`) }).first();

                if (await dayEl.isVisible()) {
                    await dayEl.click({ force: true });
                    log(`Successfully clicked day ${targetDay} in calendar.`);
                    await page.waitForTimeout(1000);

                    // Verify if picker closed or check if it stayed
                    if (!(await picker.isVisible({ timeout: 1000 }).catch(() => false))) {
                        return;
                    }
                } else {
                    log(`Day ${targetDay} not visible/valid in current month view.`);
                }
            }
        } catch (e) {
            log(`Date picker interaction failed: ${e.message}. Falling back to manual fill.`);
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

async function runSingleProfile(profile, limitUploads = false, uploadLimitCount = 0) {
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
        const uploadedCount = await uploadVideo(profile, videoFolder, videos, limitUploads, uploadLimitCount);

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

const TELEGRAM_TOKEN = "7952619216:AAFO_cgfDyV1TRism4j7shaaTIgGdtxF6pU";
const TELEGRAM_CHAT_ID = "1370074402";

async function sendTelegramNotification(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`[Telegram] Message sent: ${message.replace(/<[^>]*>/g, '')}`);
    } catch (err) {
        console.error('Failed to send Telegram notification:', err.message);
    }
}

async function uploadVideo(profile, videoFolder, videos, limitUploads = false, uploadLimitCount = 0) {
    const userDataDir = path.join(PROFILES_DIR, profile.name);
    let uploadedCount = 0;
    let lastScheduledTime = null;

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
        let page = await browser.newPage();
        log(`Automation started for profile: ${profile.name}`);

        if (videos.length === 0) {
            log(`No compatible videos found in ${videoFolder}. Skipping.`);
            await browser.close();
            return 0;
        }

        const maxUploads = (limitUploads && uploadLimitCount > 0)
            ? uploadLimitCount
            : (profile.is_scheduled === 1 && profile.upload_count > 0)
                ? profile.upload_count
                : videos.length;
        const uploadLimit = Math.min(videos.length, maxUploads);

        for (let i = 0; i < videos.length; i++) {
            if (uploadedCount >= maxUploads) {
                log(`Reached target upload count: ${uploadedCount}. Stopping.`);
                break;
            }
            const videoFileName = videos[i];
            const videoPath = path.join(videoFolder, videoFileName);

            log(`Processing video ${i + 1}/${videos.length}: ${videoFileName}`);

            // Navigate to upload page with active polling
            let initialized = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    log(`Navigating to upload page (Attempt ${attempt}/3)...`);
                    await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });

                    log(`Active polling for upload components...`);
                    // Smart polling loop: check every 1s for up to 30s
                    for (let poll = 0; poll < 30; poll++) {
                        const [hasInput, hasButton, isLogin] = await Promise.all([
                            page.$('input[type="file"]'),
                            page.$('button.upload-stage-btn, .upload-stage-btn, [data-e2e="upload-video-button"]'),
                            page.evaluate(() => window.location.href.includes('login'))
                        ]);

                        if (hasButton || hasInput) {
                            log(`Components detected via polling.`);
                            initialized = true;
                            break;
                        }
                        if (isLogin) {
                            log(`Redirected to login page. Please log in.`);
                            initialized = true; // Still "initialized" in terms of navigation, but with warning
                            break;
                        }
                        await page.waitForTimeout(1000);
                    }

                    if (initialized) break;
                } catch (e) {
                    log(`Attempt ${attempt} failed: ${e.message}`);
                    if (attempt < 3) {
                        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
                    }
                }
            }

            if (!initialized) {
                throw new Error('Upload page components not found. Page might be too slow or blocked.');
            }

            log(`Selecting file...`);
            let uploaded = false;

            // Strategy 1: Intercept filechooser with resilient waiting
            const uploadButtonSelectors = [
                '[data-e2e="upload-video-button"]',
                'button.upload-stage-btn',
                'button:has-text("Select videos")',
                '.upload-stage-btn',
                'button[class*="upload"]'
            ];
            for (const sel of uploadButtonSelectors) {
                try {
                    const el = await page.waitForSelector(sel, { timeout: 5000, state: 'visible' }).catch(() => null);
                    if (el) {
                        log(`Found upload button: ${sel}. Intercepting filechooser...`);
                        const [fileChooser] = await Promise.all([
                            page.waitForEvent('filechooser', { timeout: 20000 }),
                            el.click()
                        ]);
                        await fileChooser.setFiles(videoPath);
                        log(`Strategy 1 success via ${sel}`);
                        uploaded = true;
                        break;
                    }
                } catch (e) { }
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
                } catch (e) { }
            }

            if (!uploaded) throw new Error('Could not find file input or upload button');

            log(`Video file selection complete. Waiting for UI...`);
            await page.waitForTimeout(3000);

            // --- NEW TASKS: Clear Title & Add Sound ---
            try {
                log(`Waiting for upload UI components...`);
                await page.waitForSelector('.video-info-container, textarea, .DraftEditor-root, button:has-text("Edit video"), [data-button-name="sounds"], button:has-text("Post")', { timeout: 60000 });
                await page.waitForTimeout(5000);

                const shouldRemoveTitle = Number(profile.remove_title) === 1;
                if (shouldRemoveTitle) {
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
                        } catch (e) { }
                    }
                } else {
                    log(`remove_title tắt: Giữ lại tiêu đề video.`);
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

            // --- TASK: Wait for video upload to complete ---
            try {
                log("Waiting for video upload to complete...");
                const cancelBtn = page.locator('button:has-text("Cancel")');
                await cancelBtn.waitFor({ state: 'detached', timeout: 20 * 60 * 1000 });
                log("Upload complete (Cancel button is gone). Waiting 5s for UI to settle...");
                await page.waitForTimeout(5000);
            } catch (uploadErr) {
                log(`Warning/Error waiting for upload completion: ${uploadErr.message}`);
            }

            // --- TASK: Content Check Lite ---
            let checkSuccess = true;
            if (profile.need_content_check !== 0) {
                try {
                    log(`Starting Content check lite validation...`);
                    // Wait for toggle/switch container to be attached
                    const headline = page.locator('.headline-wrapper', { hasText: 'Content check lite' });
                    await headline.waitFor({ timeout: 5000 }).catch(() => null);

                    if (await headline.count() > 0) {
                        const switchContent = headline.locator('.Switch__content');
                        if (await switchContent.count() > 0) {
                            const isChecked = await switchContent.getAttribute('data-state') === 'checked' || await switchContent.getAttribute('aria-checked') === 'true';
                            if (!isChecked) {
                                log("Content check lite is not enabled. Enabling it...");
                                await switchContent.click({ force: true });
                            } else {
                                log("Content check lite is already enabled.");
                            }

                            log("Waiting for Content check lite to complete...");
                            let checkStartTime = Date.now();
                            const maxCheckTime = 12 * 60 * 1000; // 12 minutes max
                            let toggledRetry = false;
                            checkSuccess = false;

                            while (Date.now() - checkStartTime < maxCheckTime) {
                                const status = await page.evaluate(() => {
                                    const successEl = document.querySelector('.status-result.status-success');
                                    if (successEl && successEl.getAttribute('data-show') === 'true') {
                                        return 'success';
                                    }
                                    const warnEl = document.querySelector('.status-result.status-warn');
                                    if (warnEl && warnEl.getAttribute('data-show') === 'true') {
                                        return 'warn';
                                    }
                                    const errorEl = document.querySelector('.status-result.status-error');
                                    if (errorEl && errorEl.getAttribute('data-show') === 'true') {
                                        return 'error';
                                    }
                                    const checkingEl = document.querySelector('.status-result.status-checking');
                                    if (checkingEl && checkingEl.getAttribute('data-show') === 'true') {
                                        return 'checking';
                                    }
                                    const readyEls = Array.from(document.querySelectorAll('.status-result.status-ready'));
                                    const visibleReady = readyEls.find(el => el.getAttribute('data-show') === 'true');
                                    if (visibleReady) {
                                        const text = visibleReady.innerText || "";
                                        if (text.includes("limit")) {
                                            return 'limit_reached';
                                        }
                                        if (text.includes("government") || text.includes("politician")) {
                                            return 'restricted';
                                        }
                                        return 'ready_initial';
                                    }
                                    return 'unknown';
                                });

                                log(`Content check status: ${status}`);

                                if (status === 'success' || status === 'limit_reached') {
                                    if (status === 'limit_reached') {
                                        log("Daily content check limit reached. Proceeding to post without safety check validation.");
                                    }
                                    checkSuccess = true;
                                    break;
                                } else if (status === 'checking' || status === 'unknown' || status === 'ready_initial') {
                                    // Stuck check retry logic: If waiting for 3 minutes and retry has not been done yet, click twice
                                    if (!toggledRetry && (Date.now() - checkStartTime > 3 * 60 * 1000)) {
                                        log("Stuck in checking for 3 minutes. Toggling Content check lite off and on again...");
                                        try {
                                            await switchContent.click({ force: true });
                                            await page.waitForTimeout(1000);
                                            await switchContent.click({ force: true });
                                            await page.waitForTimeout(2000);
                                            toggledRetry = true;
                                            checkStartTime = Date.now(); // Reset timer after toggling
                                        } catch (toggleErr) {
                                            log(`Failed to toggle retry switch: ${toggleErr.message}`);
                                        }
                                    }
                                    await page.waitForTimeout(5000);
                                } else {
                                    log(`Content check failed/restricted/warned/errored with status: ${status}`);
                                    break;
                                }
                            }
                        } else {
                            log("Warning: Content check switch content selector not found.");
                        }
                    } else {
                        log("Warning: Content check lite header not found on this page.");
                    }
                } catch (checkErr) {
                    log(`Error during Content check lite: ${checkErr.message}`);
                    checkSuccess = false;
                }
            } else {
                log("Content check lite is disabled for this profile. Skipping check.");
            }

            if (!checkSuccess) {
                log(`Content check failed. Skipping posting and deleting video file.`);
                try {
                    if (fs.existsSync(videoPath)) {
                        fs.unlinkSync(videoPath);
                        log(`Deleted ${videoFileName} due to failed content check.`);
                    }
                } catch (err) {
                    log(`ERROR deleting file: ${err.message}`);
                }

                // Discard the upload by closing the page and opening a new one
                log("Resetting page to discard current upload...");
                await page.close().catch(() => null);
                page = await browser.newPage();
                continue; // Skip rest of loop and process next video
            }
            // --- END TASK: Content Check Lite ---

            // --- TASK 3: Scheduled Publishing ---
            if (!limitUploads && profile.auto_increment_schedule) {
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

                        await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_autoincrement_${i + 1}.png`) }).catch(() => null);
                    }
                } catch (e) {
                    log(`Auto-increment scheduling failed: ${e.message}`);
                }
            } else if (!limitUploads && profile.is_scheduled && i >= 3) {
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
                        await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_scheduled_${i + 1}.png`) }).catch(() => null);
                    }
                } catch (e) {
                    log(`Scheduling task failed: ${e.message}`);
                }
            }
            // --- END TASK 3 ---

            log(`Starting Post click sequence...`);
            let clickedPost = false;
            let capturedVideoId = null;

            // Intercept TikTok API responses to capture the video ID
            const responseHandler = async (response) => {
                try {
                    const url = response.url();
                    const status = response.status();
                    if (status >= 200 && status < 300 &&
                        (url.includes('/publish') || url.includes('/create') || url.includes('/post') ||
                         url.includes('/upload') || url.includes('/item'))) {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('json')) {
                            const text = await response.text().catch(() => '');
                            if (text) {
                                // Search for video/item ID patterns in the response body
                                const idPatterns = [
                                    /"publish_id"\s*:\s*"(\d+)"/,
                                    /"video_id"\s*:\s*"(\d+)"/,
                                    /"item_id"\s*:\s*"(\d+)"/,
                                    /"aweme_id"\s*:\s*"(\d+)"/,
                                    /"id"\s*:\s*"(\d{15,})"/,
                                ];
                                for (const pattern of idPatterns) {
                                    const match = text.match(pattern);
                                    if (match && match[1]) {
                                        capturedVideoId = match[1];
                                        log(`Captured video ID from API: ${capturedVideoId} (via ${url.split('?')[0]})`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { /* silently ignore */ }
            };
            page.on('response', responseHandler);

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

            // Remove the response listener
            page.removeListener('response', responseHandler);

            if (clickedPost) {
                log(`Finalizing upload for ${videoFileName}...`);
                let videoLink = null;

                // Build the video link from the captured video ID
                if (capturedVideoId) {
                    videoLink = `https://www.tiktok.com/@${profile.name}/video/${capturedVideoId}`;
                    log(`Built video link from captured ID: ${videoLink}`);
                } else {
                    // Fallback: try to find a video ID from the current page URL
                    try {
                        const currentUrl = page.url();
                        const urlMatch = currentUrl.match(/\/video\/(\d+)/);
                        if (urlMatch) {
                            videoLink = `https://www.tiktok.com/@${profile.name}/video/${urlMatch[1]}`;
                            log(`Built video link from current URL: ${videoLink}`);
                        } else {
                            log(`No video ID captured from API or URL.`);
                        }
                    } catch (e) {
                        log(`Error checking URL for video ID: ${e.message}`);
                    }
                }

                try {
                    if (fs.existsSync(videoPath)) {
                        fs.unlinkSync(videoPath);
                        log(`SUCCESS: Deleted ${videoFileName} after upload.`);
                    }
                    uploadedCount++;
                } catch (err) {
                    log(`ERROR deleting file: ${err.message}`);
                }

                try {
                    let message = `🎉 <b>Upload TikTok thành công!</b>\n` +
                                  `👤 <b>Profile:</b> <code>${profile.name}</code>\n` +
                                  `📹 <b>Video:</b> <code>${videoFileName}</code>\n` +
                                  `📅 <b>Thời gian:</b> <code>${new Date().toLocaleString('vi-VN')}</code>`;
                    if (videoLink) {
                        message += `\n🔗 <b>Link video:</b> <a href="${videoLink}">${videoLink}</a>`;
                    }
                    await sendTelegramNotification(message);
                } catch (telegramErr) {
                    log(`ERROR sending Telegram notification: ${telegramErr.message}`);
                }

                // Wait before next loop iteration to let things settle
                if (i < videos.length - 1) {
                    log(`Preparing for next video...`);
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

    if (runningProfiles.has(profileId) || processingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently running upload automation or processing a video' });
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
        } catch (e) { }
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
        } catch (e) { }
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
        } catch (e) { }
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
        } catch (e) { }
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
        } catch (e) { }
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
        } catch (e) { }
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
                } catch (e) { }
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
    } catch (e) { }

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
        } catch (e) { }
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
                if (!runningProfiles.has(profile.id) && !processingProfiles.has(profile.id)) {
                    console.log(`[Scheduler] Triggering automation for: ${profile.name}`);
                    runSingleProfile(profile).catch(err => console.error(`[Scheduler] Error running ${profile.name}:`, err));
                } else {
                    console.log(`[Scheduler] Profile ${profile.name} is already running or processing a video, skipping scheduled trigger.`);
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
