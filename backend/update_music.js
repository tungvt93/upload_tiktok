const Database = require('better-sqlite3');
const path = require('path');

// tiktok.db is in the parent directory (d:\TIKTOK\upload_tiktok)
const db = new Database(path.join(__dirname, '..', 'tiktok.db'));
const musicSearch = 'Moonlight on Jade Waters Rashad Daugherty';

// Get group IDs
const groups = db.prepare("SELECT id, name FROM groups WHERE name IN ('Arg', 'Mexico')").all();

if (groups.length === 0) {
    console.log("Groups 'Arg' and/or 'Mexico' not found.");
} else {
    for (const group of groups) {
        console.log(`Found group: ${group.name} (ID: ${group.id})`);
        const info = db.prepare("UPDATE profiles SET music_search = ? WHERE group_id = ?").run(musicSearch, group.id);
        console.log(`Updated ${info.changes} profiles in group ${group.name}`);
    }
}
db.close();
