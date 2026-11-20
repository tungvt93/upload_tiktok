import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { buildProfilesJsonExport, parseStoredCookies } from '../profile-json-export.js';
import { importProfilesJson, parseProfilesJson } from '../profile-json-import.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

function makeDb() {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE profiles (
            id TEXT PRIMARY KEY, name TEXT UNIQUE, status TEXT DEFAULT 'idle',
            is_scheduled INTEGER DEFAULT 0, auto_increment_schedule INTEGER DEFAULT 0,
            schedule_interval INTEGER DEFAULT 5, group_id TEXT, video_folder TEXT,
            set_music INTEGER DEFAULT 0, upload_count INTEGER DEFAULT 1, needs_render INTEGER DEFAULT 1,
            remove_title INTEGER DEFAULT 1, need_content_check INTEGER DEFAULT 1, use_proxy INTEGER DEFAULT 1,
            account_id TEXT, pass TEXT, email TEXT, pass_email TEXT, cookies TEXT, music_search TEXT, proxy TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO groups (id, name) VALUES ('g1', 'Kênh 1');
        INSERT INTO profiles (id, name, group_id, account_id, pass, email, pass_email, cookies, set_music, need_content_check, schedule_interval, proxy, video_folder)
          VALUES ('p1', 'userA', 'g1', 'userA', 'pw', 'a@x.com', 'epw', '[{"name":"sessionid","value":"abc","domain":".tiktok.com","path":"/"}]', 1, 0, 15, NULL, '/up/userA');
        INSERT INTO profiles (id, name, group_id, account_id, pass, cookies, set_music, need_content_check, schedule_interval, proxy)
          VALUES ('p2', 'userB', NULL, 'userB', 'pw2', NULL, 0, 1, 10, 'http://1.2.3.4:8080');
        INSERT INTO profiles (id, name, account_id, cookies)
          VALUES ('p3', 'userC', 'userC', 'sid=xyz; ttwid=1');
    `);
    return db;
}

test('parseStoredCookies handles JSON arrays and header strings', () => {
    assert.equal(parseStoredCookies(null).length, 0);
    assert.equal(parseStoredCookies('[]').length, 0);
    assert.equal(parseStoredCookies('[{"name":"a","value":"1"}]')[0].name, 'a');
    const hdr = parseStoredCookies('sid=xyz; ttwid=1');
    assert.deepEqual(hdr.map((c) => [c.name, c.value]), [['sid', 'xyz'], ['ttwid', '1']]);
});

test('exports DB cookies without touching the browser, in importable v3 format', async () => {
    const db = makeDb();
    let browserCalls = [];
    const { data, stats } = await buildProfilesJsonExport({
        db,
        profileIds: ['p1', 'p2'],
        readBrowserCookies: async (p) => { browserCalls.push(p.name); return [{ name: 'from-browser', value: 'b' }]; },
    });
    assert.equal(data.version, 3);
    assert.deepEqual(browserCalls, ['userB'], 'only profiles without DB cookies hit the browser');
    assert.equal(stats.cookiesFromDb, 1);
    assert.equal(stats.cookiesFromBrowser, 1);

    const a = data.profiles.find((p) => p.name === 'userA');
    assert.equal(a.groupName, 'Kênh 1');
    assert.equal(a.username, 'userA');
    assert.equal(a.password, 'pw');
    assert.equal(a.emailPassword, 'epw');
    assert.equal(a.musicEnabled, true);
    assert.equal(a.scheduleIntervalMin, 15);
    assert.equal(a.cookies[0].name, 'sessionid');

    const b = data.profiles.find((p) => p.name === 'userB');
    assert.deepEqual(b.cookies, [{ name: 'from-browser', value: 'b' }]);
    assert.equal(b.proxy, 'http://1.2.3.4:8080');

    // Round trip: the file must be accepted by the import code.
    const roundTrip = makeDb();
    roundTrip.exec('DELETE FROM profiles');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pexp-'));
    const res = importProfilesJson(roundTrip, parseProfilesJson(JSON.stringify(data)), dir);
    assert.equal(res.imported, 2);
});

test('busy profiles are not opened in the browser and failures are reported', async () => {
    const db = makeDb();
    const { stats, data } = await buildProfilesJsonExport({
        db,
        profileIds: [],
        isBusy: (row) => row.name === 'userB',
        readBrowserCookies: async (p) => { if (p.name === 'userC-x') return []; throw new Error('locked'); },
    });
    assert.equal(data.profiles.length, 3);
    assert.deepEqual(stats.browserSkipped, ['userB']);
    assert.deepEqual(stats.browserFailed, []);
    assert.equal(stats.cookiesFromDb, 2);
});

test('a browser read that throws marks the profile as failed but still exports it', async () => {
    const db = makeDb();
    const { stats, data } = await buildProfilesJsonExport({
        db,
        profileIds: ['p2'],
        readBrowserCookies: async () => { throw new Error('profile locked'); },
    });
    assert.deepEqual(stats.browserFailed, ['userB']);
    assert.equal(data.profiles[0].cookies.length, 0);
});
