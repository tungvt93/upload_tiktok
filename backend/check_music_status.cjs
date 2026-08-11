const Database = require('better-sqlite3');
const db = new Database('../data/tiktok.db');

const ARG_GROUP = '5f29bc8a-7fc0-4344-821d-3cb0a8c3e40d';
const MEXICO_GROUP = '11a89a6c-6487-4b6d-8e84-42c8e4620f90';
const MUSIC_VALUE = 'Moonlight on Jade Waters Rashad Daugherty';

// Check groups
const groups = db.prepare("SELECT * FROM groups WHERE name IN ('Arg', 'Mexico')").all();
console.log('Groups found:', JSON.stringify(groups));

// Count null
const nullArgCount = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE group_id = ? AND (music_search IS NULL OR music_search = '')").get(ARG_GROUP);
const nullMxCount = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE group_id = ? AND (music_search IS NULL OR music_search = '')").get(MEXICO_GROUP);
const totalArg = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE group_id = ?").get(ARG_GROUP);
const totalMx = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE group_id = ?").get(MEXICO_GROUP);

console.log('ARG null:', nullArgCount.c, '/', totalArg.c);
console.log('MEXICO null:', nullMxCount.c, '/', totalMx.c);
