// Export profiles to the version-3 JSON format that importProfilesJson() reads
// (see profile-json-import.js). Cookies come from the database first; when a
// profile has none stored, they are read from its browser profile via
// readBrowserCookies(profile).

export const EXPORT_FORMAT_VERSION = 3;

/**
 * Parse the stored `profiles.cookies` text into an array of cookie objects.
 * Accepts a JSON array/object (`{cookies: [...]}`) or a "name=value; name2=value2" header string.
 */
export function parseStoredCookies(text) {
    if (!text || typeof text !== 'string' || !text.trim()) return [];
    const trimmed = text.trim();
    try {
        if (trimmed.startsWith('[')) {
            const arr = JSON.parse(trimmed);
            return Array.isArray(arr) ? arr.filter((c) => c && c.name) : [];
        }
        if (trimmed.startsWith('{')) {
            const obj = JSON.parse(trimmed);
            return Array.isArray(obj.cookies) ? obj.cookies.filter((c) => c && c.name) : [];
        }
    } catch {
        return [];
    }
    return trimmed
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.includes('='))
        .map((part) => {
            const idx = part.indexOf('=');
            return {
                name: part.slice(0, idx).trim(),
                value: part.slice(idx + 1).trim(),
                domain: '.tiktok.com',
                path: '/',
            };
        });
}

function groupNameOf(row, groupMap) {
    return (row.group_id && groupMap.get(row.group_id)) || '';
}

/**
 * Build the export document.
 *
 * @param {object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {string[]} [opts.profileIds]  export only these ids; empty/omitted = all profiles
 * @param {(profile: object) => Promise<object[]>} opts.readBrowserCookies
 *        called only when the DB has no cookies for a profile
 * @param {(profile: object) => boolean} [opts.isBusy]
 *        profiles for which the browser must not be opened (already running/open)
 * @returns {Promise<{data: object, stats: object}>}
 */
export async function buildProfilesJsonExport({ db, profileIds = [], readBrowserCookies, isBusy = () => false, log = () => {} }) {
    const rows = profileIds.length > 0
        ? db.prepare(`SELECT * FROM profiles WHERE id IN (${profileIds.map(() => '?').join(',')}) ORDER BY rowid`).all(...profileIds)
        : db.prepare('SELECT * FROM profiles ORDER BY rowid').all();

    const groupMap = new Map(db.prepare('SELECT id, name FROM groups').all().map((g) => [g.id, g.name]));

    const stats = { total: rows.length, cookiesFromDb: 0, cookiesFromBrowser: 0, noCookies: 0, browserFailed: [], browserSkipped: [] };
    const profiles = [];

    for (const row of rows) {
        let cookies = parseStoredCookies(row.cookies);
        if (cookies.length > 0) {
            stats.cookiesFromDb++;
        } else if (isBusy(row)) {
            stats.browserSkipped.push(row.name);
            stats.noCookies++;
        } else {
            try {
                cookies = (await readBrowserCookies(row)) || [];
                if (cookies.length > 0) {
                    stats.cookiesFromBrowser++;
                } else {
                    stats.noCookies++;
                }
            } catch (err) {
                log(`[${row.name}] cannot read browser cookies: ${err.message}`);
                stats.browserFailed.push(row.name);
                stats.noCookies++;
                cookies = [];
            }
        }

        profiles.push({
            id: row.id,
            name: row.name,
            groupName: groupNameOf(row, groupMap),
            username: row.account_id || '',
            password: row.pass || null,
            twoFactorSecret: null,
            email: row.email || null,
            emailPassword: row.pass_email || null,
            recoveryEmail: null,
            proxy: row.proxy || null,
            videoFolder: row.video_folder || null,
            cookies,
            musicEnabled: !!row.set_music,
            contentCheckEnabled: !!row.need_content_check,
            scheduleIntervalMin: Number(row.schedule_interval) || 10,
            browser: 'chrome',
            followersCount: null,
            followersUpdatedAt: null,
            lastScheduledAt: null,
        });
    }

    const data = {
        version: EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        groups: [],
        profiles,
    };
    return { data, stats };
}
