// Import profiles from the JSON export format (version 3), e.g.
// tiktok-profiles-<date>-chia-se-co-cookie.json:
//
// {
//   "version": 3,
//   "exportedAt": "...",
//   "groups": [],
//   "profiles": [
//     { "id", "name", "groupName", "username", "password", "twoFactorSecret",
//       "email", "emailPassword", "recoveryEmail", "proxy", "videoFolder",
//       "cookies": [ {name, value, domain, path, expires, httpOnly, secure, sameSite} ],
//       "musicEnabled", "contentCheckEnabled", "scheduleIntervalMin", "browser", ... }
//   ]
// }
//
// Mapping to the local `profiles` table:
//   name                 -> name
//   groupName            -> group_id (group is created when missing)
//   username             -> account_id
//   password             -> pass
//   email                -> email
//   emailPassword        -> pass_email
//   proxy                -> proxy
//   cookies (array)      -> cookies (stored as JSON text)
//   musicEnabled         -> set_music
//   contentCheckEnabled  -> need_content_check
//   scheduleIntervalMin  -> schedule_interval
// twoFactorSecret, recoveryEmail, browser, followers* have no local column and are ignored.

import fs from 'fs';
import path from 'path';

const FORMAT_VERSION = 3;

function newId() {
    return Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
}

function str(value) {
    if (value === null || value === undefined) return null;
    const s = typeof value === 'string' ? value.trim() : String(value).trim();
    return s === '' ? null : s;
}

function bool(value, fallback) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === 1 || value === '1' || value === 'true') return 1;
    if (value === 0 || value === '0' || value === 'false') return 0;
    return fallback;
}

function interval(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function proxyToString(proxy) {
    if (proxy === null || proxy === undefined || proxy === '') return null;
    if (typeof proxy === 'string') return str(proxy);
    if (typeof proxy === 'object') {
        // Keep the same shape the app stores elsewhere: a plain server string when possible.
        if (typeof proxy.server === 'string' && proxy.server.trim()) return proxy.server.trim();
        return JSON.stringify(proxy);
    }
    return null;
}

/**
 * Parse and validate the JSON export text.
 * Throws an Error with a user-facing message when the structure is wrong.
 */
export function parseProfilesJson(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error('File JSON không hợp lệ: ' + err.message);
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.profiles)) {
        throw new Error('File JSON không đúng định dạng: thiếu mảng "profiles"');
    }
    return data;
}

/**
 * Insert profiles from parsed export data into the database.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} data        parsed JSON (see header)
 * @param {string} uploadsDir  base folder used for per-profile video folders
 * @returns {{imported: number, skipped: number, errors: string[], warnings: string[]}}
 */
export function importProfilesJson(db, data, uploadsDir) {
    const results = { imported: 0, skipped: 0, errors: [], warnings: [] };

    if (data.version !== undefined && Number(data.version) > FORMAT_VERSION) {
        results.warnings.push(`File version ${data.version} mới hơn ${FORMAT_VERSION}, có thể thiếu trường dữ liệu`);
    }

    const findOrCreateGroup = (groupName) => {
        const existing = db.prepare('SELECT id FROM groups WHERE LOWER(name) = LOWER(?)').get(groupName);
        if (existing) return existing.id;
        const id = newId();
        db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(id, groupName);
        return id;
    };

    const insertProfile = db.prepare(`
        INSERT INTO profiles (id, name, status, is_scheduled, auto_increment_schedule, schedule_interval,
            group_id, video_folder, set_music, upload_count, needs_render, remove_title,
            need_content_check, use_proxy, account_id, pass, email, pass_email, cookies, proxy)
        VALUES (?, ?, 'idle', 0, 1, ?, ?, ?, ?, 1, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const existingNames = new Set(
        db.prepare('SELECT name FROM profiles').all().map((r) => (r.name || '').toLowerCase())
    );

    for (const profile of data.profiles) {
        const profileName = str(profile && profile.name);
        if (!profileName) {
            results.errors.push('Bỏ qua: profile không có tên');
            results.skipped++;
            continue;
        }

        if (existingNames.has(profileName.toLowerCase())) {
            results.errors.push(`"${profileName}": profile name already exists`);
            results.skipped++;
            continue;
        }

        const groupName = str(profile.groupName);
        const cookiesArray = Array.isArray(profile.cookies) ? profile.cookies : null;
        if (profile.cookies && !cookiesArray) {
            results.warnings.push(`"${profileName}": cookies không phải mảng, đã bỏ qua cookies`);
        }
        const cookiesText = cookiesArray && cookiesArray.length > 0 ? JSON.stringify(cookiesArray) : null;

        const videoFolder = groupName
            ? path.join(uploadsDir, groupName, profileName)
            : path.join(uploadsDir, profileName);

        const id = newId();

        try {
            const groupId = groupName ? findOrCreateGroup(groupName) : null;
            const proxy = proxyToString(profile.proxy);
            fs.mkdirSync(videoFolder, { recursive: true });
            insertProfile.run(
                id,                                        // id
                profileName,                               // name
                interval(profile.scheduleIntervalMin, 10), // schedule_interval
                groupId,                                   // group_id
                videoFolder,                               // video_folder
                bool(profile.musicEnabled, 0),             // set_music
                bool(profile.contentCheckEnabled, 0),      // need_content_check
                proxy ? 1 : 0,                             // use_proxy
                str(profile.username),                     // account_id
                str(profile.password),                     // pass
                str(profile.email),                        // email
                str(profile.emailPassword),                // pass_email
                cookiesText,                               // cookies
                proxy                                      // proxy
            );
            existingNames.add(profileName.toLowerCase());
            results.imported++;
        } catch (e) {
            results.errors.push(`"${profileName}": ${e.message}`);
            results.skipped++;
        }
    }

    return results;
}
