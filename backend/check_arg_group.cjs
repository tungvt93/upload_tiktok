const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'tiktok.db'));
const argGroup = db.prepare("SELECT id FROM groups WHERE name = 'Arg'").get();
if (argGroup) {
    const profiles = db.prepare("SELECT name, group_id, music_search FROM profiles WHERE group_id = ?").all(argGroup.id);
    console.log("Found", profiles.length, "profiles in Arg group in DB.");
    console.log(profiles.filter(p => p.name.includes('Alejo Igoa28')));
} else {
    console.log("Arg group not found in DB");
}
db.close();
