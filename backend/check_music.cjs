const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'tiktok.db'));
const group = db.prepare("SELECT id FROM groups WHERE name = 'Arg'").get();
if (group) {
    const profile = db.prepare("SELECT name, music_search FROM profiles WHERE group_id = ? LIMIT 1").get(group.id);
    console.log(profile);
} else {
    console.log('Group not found');
}
