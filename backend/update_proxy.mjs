import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'tiktok.db');

const db = new Database(dbPath);

const NEW_PROXY = 'http://PVN523742:sZCS6l2I@14.225.58.129:50000';
const EXCLUDED_GROUPS = ['Mexico', 'Arg', 'Đủ DK'];

// Xem trước các profile sẽ bị update
const previewRows = db.prepare(`
    SELECT p.id, p.name, p.proxy, g.name AS group_name
    FROM profiles p
    LEFT JOIN groups g ON g.id = p.group_id
    WHERE (g.name IS NULL OR g.name NOT IN (${EXCLUDED_GROUPS.map(() => '?').join(',')}))
`).all(...EXCLUDED_GROUPS);

console.log(`\n=== PREVIEW: ${previewRows.length} profiles sẽ được update ===`);
previewRows.forEach(r => {
    console.log(`  [${r.group_name ?? '(no group)'}] ${r.name} | proxy hiện tại: ${r.proxy ?? '(none)'}`);
});

// Thực hiện update
const result = db.prepare(`
    UPDATE profiles
    SET proxy = ?
    WHERE id IN (
        SELECT p.id
        FROM profiles p
        LEFT JOIN groups g ON g.id = p.group_id
        WHERE (g.name IS NULL OR g.name NOT IN (${EXCLUDED_GROUPS.map(() => '?').join(',')}))
    )
`).run(NEW_PROXY, ...EXCLUDED_GROUPS);

console.log(`\n✅ Đã update ${result.changes} profile(s) với proxy: ${NEW_PROXY}`);

db.close();
