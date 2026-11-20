import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { parseProfilesJson, importProfilesJson } from '../profile-json-import.js';

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
            account_id TEXT, pass TEXT, email TEXT, pass_email TEXT, cookies TEXT, music_search TEXT, proxy TEXT
        );
    `);
    return db;
}

function tmpUploads() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pjson-'));
}

const sample = {
    version: 3,
    exportedAt: '2026-11-17T09:31:02.636Z',
    groups: [],
    profiles: [
        {
            id: 'old-1', name: 'userA', groupName: 'Kênh 1', username: 'userA', password: 'pw1',
            twoFactorSecret: null, email: 'a@x.com', emailPassword: 'epw', recoveryEmail: null,
            proxy: null, videoFolder: null,
            cookies: [{ name: 'sessionid', value: 'abc', domain: '.tiktok.com', path: '/', expires: 1, httpOnly: true, secure: true, sameSite: 'Lax' }],
            musicEnabled: true, contentCheckEnabled: false, scheduleIntervalMin: 15, browser: 'chrome',
            followersCount: null, followersUpdatedAt: null, lastScheduledAt: null,
        },
        {
            id: 'old-2', name: 'userB', groupName: 'kênh 1', username: 'userB', password: null,
            email: null, emailPassword: null, proxy: 'http://1.2.3.4:8080', cookies: [],
            musicEnabled: false, contentCheckEnabled: true, scheduleIntervalMin: 'abc', browser: 'chrome',
        },
    ],
};

test('parseProfilesJson rejects non-JSON and files without a profiles array', () => {
    assert.throws(() => parseProfilesJson('{not json'), /không hợp lệ/);
    assert.throws(() => parseProfilesJson('{"version":3}'), /profiles/);
    assert.equal(parseProfilesJson(JSON.stringify(sample)).profiles.length, 2);
});

test('importProfilesJson maps fields, creates groups and cookies JSON', () => {
    const db = makeDb();
    const uploads = tmpUploads();
    const res = importProfilesJson(db, sample, uploads);
    assert.equal(res.imported, 2);
    assert.equal(res.skipped, 0);

    const a = db.prepare('SELECT * FROM profiles WHERE name = ?').get('userA');
    assert.equal(a.account_id, 'userA');
    assert.equal(a.pass, 'pw1');
    assert.equal(a.email, 'a@x.com');
    assert.equal(a.pass_email, 'epw');
    assert.equal(a.set_music, 1);
    assert.equal(a.need_content_check, 0);
    assert.equal(a.schedule_interval, 15);
    assert.equal(a.use_proxy, 0);
    assert.deepEqual(JSON.parse(a.cookies)[0].name, 'sessionid');
    assert.equal(a.video_folder, path.join(uploads, 'Kênh 1', 'userA'));
    assert.ok(fs.existsSync(a.video_folder));

    const b = db.prepare('SELECT * FROM profiles WHERE name = ?').get('userB');
    assert.equal(b.group_id, a.group_id, 'group lookup is case-insensitive and reuses the group');
    assert.equal(b.proxy, 'http://1.2.3.4:8080');
    assert.equal(b.use_proxy, 1);
    assert.equal(b.schedule_interval, 10, 'invalid interval falls back to 10');
    assert.equal(b.cookies, null, 'empty cookie array stored as NULL');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM groups').get().n, 1);
});

test('importProfilesJson skips existing names and nameless profiles', () => {
    const db = makeDb();
    const uploads = tmpUploads();
    importProfilesJson(db, sample, uploads);
    const again = importProfilesJson(db, {
        profiles: [{ name: 'USERA' }, { name: '   ' }, { name: 'userC' }],
    }, uploads);
    assert.equal(again.imported, 1);
    assert.equal(again.skipped, 2);
    assert.match(again.errors[0], /already exists/);
});
