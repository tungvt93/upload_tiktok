/**
 * douyin-smoke.mjs — offline integration smoke test for the Douyin Downloader.
 * Runs against an in-memory SQLite DB with DOUYIN_MOCK=1 so no network is needed.
 *
 * Usage: node tests/douyin-smoke.mjs
 */

// Must be the first import so DOUYIN_MOCK=1 is visible before douyin modules load.
import './helpers/mock-env.mjs';

import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { initDouyinSchema, createCreator, getStats, listVideos } from '../douyin-store.js';
import { createDouyinWorker } from '../douyin-worker.js';
import { createCreatorMonitor } from '../douyin-scheduler.js';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = new Database(':memory:');
db.pragma('journal_mode = WAL');

// 1. Schema
initDouyinSchema(db);
check('schema initialized', true);

const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-smoke-'));
const worker = createDouyinWorker({ db, storageDir, concurrency: 2 });
const monitor = createCreatorMonitor({ db, worker });

// 2. Enqueue a download and wait for completion
const job = worker.enqueueUrl('https://v.douyin.com/mock1');
check('job enqueued (QUEUED)', ['QUEUED', 'PENDING'].includes(job.status), job.status);

await new Promise((resolve) => setTimeout(resolve, 600));

const finalJob = (() => {
    const row = db.prepare('SELECT * FROM dy_download_jobs WHERE id = ?').get(job.id);
    return row;
})();

check('job reached terminal state', ['COMPLETED', 'FAILED'].includes(finalJob.status), finalJob.status);

const video = db.prepare('SELECT * FROM dy_videos WHERE id = ?').get(finalJob.video_id);
check('video metadata stored', !!video && video.douyin_video_id && video.title, video?.title);
check('video id extracted (non-placeholder)', !!video && !String(video.douyin_video_id).startsWith('pending_'), video?.douyin_video_id);
check('file written to storage', !!video && !!video.file_path && fs.existsSync(video.file_path), video?.file_path);
check('file size recorded', !!video && Number(video.file_size) > 0, String(video.file_size));

// 3. Stats
const stats = getStats(db);
check('stats: totalVideos = 1', stats.totalVideos === 1, `totalVideos=${stats.totalVideos}`);
check('stats: downloadedToday = 1', stats.downloadedToday >= 1, `downloadedToday=${stats.downloadedToday}`);

// 4. Creator + monitor
const creator = createCreator(db, {
    nickname: 'Smoke Creator',
    unique_id: 'smoke_1',
    url: 'https://www.douyin.com/user/mock_sec_uid',
    is_active: 1,
});
check('creator registered', !!creator.id, creator.nickname);

const creatorResult = await monitor.checkCreator(creator.id);
check('creator check ran', creatorResult.checked === true, JSON.stringify(creatorResult));

const statsAfter = getStats(db);
check('creator check created video jobs', statsAfter.totalVideos >= 2, `totalVideos=${statsAfter.totalVideos}`);
check(
    'creator-link preserved',
    db.prepare('SELECT COUNT(*) AS c FROM dy_videos WHERE creator_id = ?').get(creator.id).c > 0,
    'videos linked to creator'
);

// 5. History listing (search/pagination/sort)
const list = listVideos(db, {
    search: 'mock',
    page: 1,
    pageSize: 10,
    sortBy: 'created_at',
    sortOrder: 'desc',
});
check('history list works', list.data.length > 0 && list.pagination.total > 0, `total=${list.pagination.total}`);

// 6. Guard: duplicate video download does not duplicate rows
const before = db.prepare('SELECT COUNT(*) AS c FROM dy_videos').get().c;
worker.enqueueUrl('https://v.douyin.com/mock1');
await new Promise((resolve) => setTimeout(resolve, 2000));
const after = db.prepare('SELECT COUNT(*) AS c FROM dy_videos').get().c;
check('duplicate URL reuses same video row', after === before, `before=${before} after=${after}`);

// Cleanup
fs.rmSync(storageDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
