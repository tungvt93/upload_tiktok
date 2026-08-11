import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPaths = [
    path.join(__dirname, '..', 'data', 'tiktok.db'),
    path.join(__dirname, '..', 'tiktok.db')
];

const NEW_PROXY = 'http://jwJziJ:acXaAb@1.55.197.215:56501';
const NEW_NEEDS_RENDER = 0; // false
const NEW_SET_MUSIC = 1;    // true
const NEW_NEED_CONTENT_CHECK = 0; // false

dbPaths.forEach(dbPath => {
    try {
        console.log(`\n========================================`);
        console.log(`Checking Database: ${dbPath}`);
        const db = new Database(dbPath);
        
        const groupRow = db.prepare(`SELECT * FROM groups WHERE name = 'Clone_us_T'`).get();
        if (!groupRow) {
            console.log(`Group 'Clone_us_T' not found in ${dbPath}`);
            db.close();
            return;
        }

        const groupId = groupRow.id;
        console.log(`Found Group 'Clone_us_T' with ID: ${groupId}`);

        const beforeRows = db.prepare(`
            SELECT id, name, proxy, needs_render, set_music, need_content_check
            FROM profiles
            WHERE group_id = ?
        `).all(groupId);

        console.log(`Found ${beforeRows.length} profile(s) in group 'Clone_us_T'.`);

        if (beforeRows.length === 0) {
            db.close();
            return;
        }

        console.log('\n--- BEFORE UPDATE (Sample first 5 profiles) ---');
        beforeRows.slice(0, 5).forEach(r => console.log(r));

        const updateStmt = db.prepare(`
            UPDATE profiles
            SET proxy = ?,
                needs_render = ?,
                set_music = ?,
                need_content_check = ?
            WHERE group_id = ?
        `);

        const result = updateStmt.run(
            NEW_PROXY,
            NEW_NEEDS_RENDER,
            NEW_SET_MUSIC,
            NEW_NEED_CONTENT_CHECK,
            groupId
        );

        console.log(`\n✅ Successfully updated ${result.changes} profile(s).`);

        const afterRows = db.prepare(`
            SELECT id, name, proxy, needs_render, set_music, need_content_check
            FROM profiles
            WHERE group_id = ?
        `).all(groupId);

        console.log('\n--- AFTER UPDATE (Sample first 5 profiles) ---');
        afterRows.slice(0, 5).forEach(r => console.log(r));

        db.close();
    } catch (err) {
        console.error(`Error processing database ${dbPath}:`, err);
    }
});
