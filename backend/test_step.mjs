import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing dummy DB...');
try {
    const dbTest = new Database(path.join(__dirname, 'test.db'));
    console.log('Dummy DB opened successfully!');
    dbTest.close();
} catch (e) {
    console.error('Dummy DB failed:', e);
}

console.log('Testing tiktok.db with timeout / options...');
try {
    const dbReal = new Database(path.join(__dirname, '..', 'data', 'tiktok.db'), { timeout: 3000, verbose: console.log });
    console.log('tiktok.db opened successfully!');
    dbReal.close();
} catch (e) {
    console.error('tiktok.db failed:', e);
}
