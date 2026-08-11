import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.join(__dirname, '..', 'data', 'tiktok.db');
const NEW_AUTO_INCREMENT = 1; // true
const NEW_SCHEDULE_INTERVAL = 10; // 10 phút

try {
    console.log(`Checking Database: ${dbPath}`);
    const db = new Database(dbPath);

    const groupRow = db.prepare(`SELECT * FROM groups WHERE name = 'Clone_us_T'`).get();
    if (!groupRow) {
        console.error("Group 'Clone_us_T' not found");
        process.exit(1);
    }

    const groupId = groupRow.id;
    console.log(`Found Group 'Clone_us_T' ID: ${groupId}`);

    const beforeRows = db.prepare(`
        SELECT id, name, auto_increment_schedule, schedule_interval
        FROM profiles
        WHERE group_id = ?
    `).all(groupId);

    console.log(`Found ${beforeRows.length} profile(s) in group 'Clone_us_T'.`);

    console.log('\n--- BEFORE UPDATE (Sample first 5) ---');
    beforeRows.slice(0, 5).forEach(r => console.log(r));

    const updateStmt = db.prepare(`
        UPDATE profiles
        SET auto_increment_schedule = ?,
            schedule_interval = ?
        WHERE group_id = ?
    `);

    const result = updateStmt.run(NEW_AUTO_INCREMENT, NEW_SCHEDULE_INTERVAL, groupId);
    console.log(`\n✅ Successfully updated ${result.changes} profile(s).`);

    const afterRows = db.prepare(`
        SELECT id, name, auto_increment_schedule, schedule_interval
        FROM profiles
        WHERE group_id = ?
    `).all(groupId);

    console.log('\n--- AFTER UPDATE (Sample first 5) ---');
    afterRows.slice(0, 5).forEach(r => console.log(r));

    db.close();
} catch (err) {
    console.error('Error updating database:', err);
}
