/**
 * douyin-integration.mjs — verifies the real `initDouyinFeature` entry point
 * (exactly what server.js calls) on a throwaway Express app + temp SQLite file.
 *
 * Usage: DOUYIN_MOCK=1 node tests/douyin-integration.mjs
 */

// Must be the first import so DOUYIN_MOCK=1 is visible before douyin modules load.
import './helpers/mock-env.mjs';

import express from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initDouyinFeature } from '../douyin-integration.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-int-'));
const dbPath = path.join(tmpDir, 'test.db');
const db = new Database(dbPath);

const app = express();
app.use(express.json());

const feature = initDouyinFeature({ app, db });

const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}/api/douyin`;

const ok = [];
const check = (name, cond) => {
    ok.push(cond);
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

try {
    const res = await fetch(`${base}/stats`);
    const stats = await res.json();
    check('GET /stats via initDouyinFeature', res.ok && typeof stats.totalVideos === 'number');
    check('douyin tables exist in temp DB', !!db.prepare("SELECT name FROM sqlite_master WHERE name = 'dy_videos'").get());
} catch (err) {
    console.error('Harness error:', err.message);
} finally {
    feature.stop();
    server.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${ok.filter(Boolean).length}/${ok.length} checks passed`);
process.exit(ok.every(Boolean) ? 0 : 1);
