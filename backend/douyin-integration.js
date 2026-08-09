/**
 * douyin-integration.js
 * ----------------------------------------------------------------------------
 * Single entry point that wires the "Douyin Downloader" feature into the host
 * Express server. `server.js` only needs to call `initDouyinFeature({ app, db })`.
 *
 *   1. Creates the SQLite tables (dy_creators, dy_videos, dy_download_jobs)
 *   2. Builds the async download worker (in-process queue + progress events)
 *   3. Builds the creator monitor (30-min scheduler)
 *   4. Mounts the REST API router at /api/douyin
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDouyinSchema } from './douyin-store.js';
import { createDouyinWorker } from './douyin-worker.js';
import { createDouyinRouter } from './douyin-router.js';
import { createCreatorMonitor } from './douyin-scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initDouyinFeature({ app, db }) {
    // 1. Schema
    initDouyinSchema(db);

    // 2. Storage directory (local filesystem storage)
    const storageDir = process.env.DOUYIN_STORAGE_DIR || path.join(__dirname, '..', 'downloads');
    fs.mkdirSync(storageDir, { recursive: true });

    // 3. Worker + monitor + router
    const concurrency = Math.max(1, Number(process.env.DOUYIN_CONCURRENCY) || 2);
    const worker = createDouyinWorker({ db, storageDir, concurrency });
    const monitor = createCreatorMonitor({ db, worker });
    const router = createDouyinRouter({ db, worker, monitor });

    // 4. Mount API
    app.use('/api/douyin', router);

    // 5. Start creator monitoring (every MONITOR_INTERVAL_MINUTES)
    const intervalMinutes = Number(process.env.MONITOR_INTERVAL_MINUTES) || 30;
    const stopScheduler = monitor.start(intervalMinutes);

    console.log('[DouyinDownloader] Feature initialized');
    console.log(`[DouyinDownloader] Storage: ${storageDir} | concurrency: ${concurrency} | monitor: every ${intervalMinutes} min`);

    return {
        worker,
        monitor,
        router,
        stop: () => {
            try {
                stopScheduler();
            } catch {
                /* already stopped */
            }
        },
    };
}

export default { initDouyinFeature };
