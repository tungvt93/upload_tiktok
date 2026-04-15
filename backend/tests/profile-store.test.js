import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { initGroupSchema, createGroup } from '../group-store.js';
import { createProfileRecord } from '../profile-store.js';

const makeDb = () => {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE profiles (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE,
            status TEXT DEFAULT 'idle',
            video_folder TEXT,
            proxy TEXT,
            is_scheduled INTEGER DEFAULT 0,
            last_run TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            group_id TEXT
        );
    `);
    initGroupSchema(db);
    return db;
};

test('createProfileRecord stores a profile without group when group_id is empty', () => {
    const db = makeDb();

    const profile = createProfileRecord(db, {
        id: 'p-1',
        name: 'Profile A',
        group_id: ''
    });

    assert.equal(profile.id, 'p-1');
    assert.equal(profile.name, 'Profile A');
    assert.equal(profile.group_id, null);
    assert.equal(profile.group_name, null);
    assert.equal(profile.status, 'idle');
    assert.equal(profile.is_scheduled, 0);
});

test('createProfileRecord stores a valid group_id', () => {
    const db = makeDb();
    createGroup(db, { id: 'g-1', name: 'Team A' });

    const profile = createProfileRecord(db, {
        id: 'p-2',
        name: 'Profile B',
        group_id: 'g-1'
    });

    assert.equal(profile.group_id, 'g-1');
    assert.equal(profile.group_name, 'Team A');
});

test('createProfileRecord stores video_folder when provided', () => {
    const db = makeDb();

    const profile = createProfileRecord(db, {
        id: 'p-video-1',
        name: 'Profile With Folder',
        group_id: '',
        video_folder: '/tmp/profile-videos'
    });

    assert.equal(profile.video_folder, '/tmp/profile-videos');
});

test('createProfileRecord normalizes empty video_folder to null', () => {
    const db = makeDb();

    const profile = createProfileRecord(db, {
        id: 'p-video-2',
        name: 'Profile Without Folder',
        group_id: '',
        video_folder: '   '
    });

    assert.equal(profile.video_folder, null);
});

test('createProfileRecord rejects a missing group', () => {
    const db = makeDb();

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-3',
                name: 'Profile C',
                group_id: 'missing'
            }),
        /group not found/i
    );
});

test('createProfileRecord does not insert when group is missing', () => {
    const db = makeDb();

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-3',
                name: 'Profile C',
                group_id: 'missing'
            }),
        /group not found/i
    );

    assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
        0
    );
});

test('createProfileRecord rejects non-string name', () => {
    const db = makeDb();

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-nonstring',
                name: {},
                group_id: ''
            }),
        (err) =>
            err.status === 400 && /name must be a string/i.test(err.message)
    );

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-nonstring-2',
                name: 123,
                group_id: ''
            }),
        (err) =>
            err.status === 400 && /name must be a string/i.test(err.message)
    );

    assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
        0
    );
});

test('createProfileRecord rejects blank or whitespace-only name', () => {
    const db = makeDb();

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-bad',
                name: '',
                group_id: ''
            }),
        (err) => err.status === 400 && /name is required/i.test(err.message)
    );

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-bad2',
                name: '   \t  ',
                group_id: ''
            }),
        (err) => err.status === 400 && /name is required/i.test(err.message)
    );

    assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
        0
    );
});

test('createProfileRecord maps duplicate name insert to a store error', () => {
    const db = makeDb();

    createProfileRecord(db, {
        id: 'p-first',
        name: 'Unique Name',
        group_id: ''
    });

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-second',
                name: 'Unique Name',
                group_id: ''
            }),
        (err) =>
            err.status === 400 &&
            /profile with this name already exists/i.test(err.message)
    );

    assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
        1
    );
});

test('createProfileRecord maps duplicate id insert to a store error', () => {
    const db = makeDb();

    createProfileRecord(db, {
        id: 'p-same-id',
        name: 'First Profile',
        group_id: ''
    });

    assert.throws(
        () =>
            createProfileRecord(db, {
                id: 'p-same-id',
                name: 'Second Profile',
                group_id: ''
            }),
        (err) =>
            err.status === 400 &&
            /profile with this id already exists/i.test(err.message)
    );

    assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
        1
    );
});
