import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'tiktok.db');
const db = new Database(dbPath);
const profiles = db.prepare('SELECT * FROM profiles WHERE name = ?').all('Tips 1');
console.log("Profiles named 'Tips 1':");
console.log(profiles);
