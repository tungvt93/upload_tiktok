const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'tiktok.db'));
const profiles = db.prepare("SELECT name, group_id, music_search FROM profiles WHERE name LIKE '%Alejo Igoa28%'").all();
console.log(profiles);
db.close();
