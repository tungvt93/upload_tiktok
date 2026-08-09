/**
 * douyin-http.mjs — HTTP-level integration test for the Douyin Downloader API.
 * Mounts the real router/worker/monitor on a throwaway Express app with an
 * in-memory SQLite DB and DOUYIN_MOCK=1. Never touches the running server/DB.
 *
 * Usage: node tests/douyin-http.mjs
 */

// Must be the first import so DOUYIN_MOCK=1 is visible before douyin modules load.
import './helpers/mock-env.mjs';

import express from 'express';
import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { initDouyinSchema } from '../douyin-store.js';
import { createDouyinWorker } from '../douyin-worker.js';
import { createDouyinRouter } from '../douyin-router.js';
import { createCreatorMonitor } from '../douyin-scheduler.js';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = new Database(':memory:');
initDouyinSchema(db);

const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-http-'));
const worker = createDouyinWorker({ db, storageDir, concurrency: 2 });
const monitor = createCreatorMonitor({ db, worker });
const router = createDouyinRouter({ db, worker, monitor });

const app = express();
app.use(express.json());
app.use('/api/douyin', router);

const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}/api/douyin`;

try {
    // 1. stats
    let res = await fetch(`${base}/stats`);
    const stats = await res.json();
    check('GET /stats', res.ok && typeof stats.totalVideos === 'number', `totalVideos=${stats.totalVideos}`);

    // 2. single download
    res = await fetch(`${base}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://v.douyin.com/http1' }),
    });
    const created = await res.json();
    check('POST /download creates job', res.status === 201 && created.job?.id, created.job?.status);

    // 3. batch
    res = await fetch(`${base}/download-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: ['https://v.douyin.com/a', 'https://v.douyin.com/b', 'https://v.douyin.com/c'] }),
    });
    const batch = await res.json();
    check('POST /download-batch creates 3 jobs', res.status === 201 && batch.jobs?.length === 3, `count=${batch.count}`);

    // 4. invalid URL rejected
    res = await fetch(`${base}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
    });
    check('invalid URL rejected (400)', res.status === 400);

    // 5. creators CRUD
    res = await fetch(`${base}/creators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: 'HTTP Creator', url: 'https://www.douyin.com/user/http_sec', is_active: 1 }),
    });
    const creator = await res.json();
    check('POST /creators', res.status === 201 && creator.id);

    res = await fetch(`${base}/creators`);
    const creators = await res.json();
    check('GET /creators', res.ok && creators.length >= 1, `count=${creators.length}`);

    res = await fetch(`${base}/creators/${creator.id}/check`, { method: 'POST' });
    const checkResult = await res.json();
    check('POST /creators/:id/check', res.ok && checkResult.checked === true, `created=${checkResult.created}`);

    // 6. wait for async downloads, then list history/jobs
    await new Promise((r) => setTimeout(r, 2500));
    res = await fetch(`${base}/videos?search=mock&page=1&pageSize=10&sortBy=created_at&sortOrder=desc`);
    const history = await res.json();
    check('GET /videos (history)', res.ok && history.data.length > 0 && history.pagination.total > 0, `total=${history.pagination.total}`);

    res = await fetch(`${base}/jobs?page=1&pageSize=10`);
    const jobs = await res.json();
    const completed = jobs.data.filter((j) => j.status === 'COMPLETED').length;
    check('GET /jobs has completed downloads', res.ok && completed > 0, `completed=${completed}/${jobs.data.length}`);

    // 7. SSE stream connects
    res = await fetch(`${base}/events`);
    check('GET /events (SSE) opens', res.ok && res.headers.get('content-type')?.includes('text/event-stream'));
    res.body?.cancel();

    // 8. delete a video
    const firstVideo = history.data[0];
    res = await fetch(`${base}/videos/${firstVideo.id}`, { method: 'DELETE' });
    check('DELETE /videos/:id', res.ok);
} catch (err) {
    console.error('Test harness error:', err.message);
} finally {
    server.close();
    fs.rmSync(storageDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
