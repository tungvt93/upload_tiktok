const Database = require('better-sqlite3');
const db = new Database('../data/tiktok.db');

const ARG_GROUP = '5f29bc8a-7fc0-4344-821d-3cb0a8c3e40d';
const MEXICO_GROUP = '11a89a6c-6487-4b6d-8e84-42c8e4620f90';
const MUSIC_VALUE = 'Moonlight on Jade Waters Rashad Daugherty';

// Update ARG
const argResult = db.prepare("UPDATE profiles SET music_search = ? WHERE group_id = ?").run(MUSIC_VALUE, ARG_GROUP);
console.log('ARG updated:', argResult.changes, 'rows');

// Update MEXICO
const mxResult = db.prepare("UPDATE profiles SET music_search = ? WHERE group_id = ?").run(MUSIC_VALUE, MEXICO_GROUP);
console.log('MEXICO updated:', mxResult.changes, 'rows');

// Verify
const verifyArg = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE group_id = ? AND music_search = ?").get(ARG_GROUP, MUSIC_VALUE);
const verifyMx = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE group_id = ? AND music_search = ?").get(MEXICO_GROUP, MUSIC_VALUE);
console.log('\n=== VERIFY ===');
console.log('ARG profiles with correct music_search:', verifyArg.c);
console.log('MEXICO profiles with correct music_search:', verifyMx.c);
