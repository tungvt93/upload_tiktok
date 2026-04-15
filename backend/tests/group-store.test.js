import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import {
    initGroupSchema,
    createGroup,
    listGroups,
    renameGroup,
    deleteGroup,
    assertGroupExists
} from '../group-store.js';

const makeDb = () => {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE profiles (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE,
            group_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    initGroupSchema(db);
    return db;
};

test('createGroup trims name and listGroups returns profile_count sorted by created_at desc', () => {
    const db = makeDb();

    createGroup(db, { id: 'g-1', name: '  Team A  ' });
    db.prepare('UPDATE groups SET created_at = ? WHERE id = ?').run(
        '2026-04-14 10:00:00',
        'g-1'
    );
    db.prepare(
        'INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)'
    ).run('g-2', 'Team B', '2026-04-15 10:00:00');
    const groups = listGroups(db);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].id, 'g-2');
    assert.equal(groups[1].id, 'g-1');
    assert.equal(groups[1].name, 'Team A');
    assert.equal(groups[1].profile_count, 0);
});

test('renameGroup rejects duplicate names', () => {
    const db = makeDb();

    createGroup(db, { id: 'g-1', name: 'Alpha' });
    createGroup(db, { id: 'g-2', name: 'Beta' });

    assert.throws(
        () => renameGroup(db, { id: 'g-2', name: 'Alpha' }),
        /already exists/i
    );
});

test('assertGroupExists throws when group is missing', () => {
    const db = makeDb();

    assert.throws(
        () => assertGroupExists(db, 'missing'),
        /not found/i
    );
});

test('deleteGroup blocks removal when profiles still reference the group', () => {
    const db = makeDb();

    createGroup(db, { id: 'g-1', name: 'Team A' });
    db.prepare(
        'INSERT INTO profiles (id, name, group_id) VALUES (?, ?, ?)'
    ).run('p-1', 'Profile 1', 'g-1');

    assert.throws(
        () => deleteGroup(db, 'g-1'),
        /still has profiles/i
    );
});
