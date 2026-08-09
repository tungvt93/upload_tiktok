/**
 * douyin-router.js
 * ----------------------------------------------------------------------------
 * REST API for the "Douyin Downloader" feature. Mounted at `/api/douyin`.
 *
 * Endpoints
 *   POST   /download                    download a single video by URL
 *   POST   /download-batch              download many URLs (creates one job each)
 *   GET    /jobs                        list download jobs (page + status filter)
 *   GET    /jobs/:id                    single job
 *   POST   /jobs/:id/retry              retry a failed job
 *   GET    /videos                      download history (search/pagination/sort)
 *   GET    /videos/:id                  single video record
 *   DELETE /videos/:id                  remove video record + file
 *   GET    /videos/:id/file             stream the downloaded file
 *   GET    /creators                    list monitored creators
 *   POST   /creators                    register a creator
 *   GET    /creators/:id                single creator
 *   PATCH  /creators/:id                update / toggle a creator
 *   DELETE /creators/:id                remove a creator
 *   POST   /creators/:id/check          check for new videos right now
 *   POST   /creators/check-all          check every active creator
 *   GET    /stats                       dashboard statistics
 *   GET    /events                      Server-Sent-Events stream (live progress)
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import {
    listCreators,
    getCreator,
    createCreator,
    updateCreator,
    deleteCreator,
    listActiveCreators,
    getVideo,
    listVideos,
    deleteVideo,
    getJob,
    listJobs,
    getStats,
} from './douyin-store.js';

const MOCK_MODE = process.env.DOUYIN_MOCK === '1';

const httpError = (res, status, message) => res.status(status).json({ error: message });

/* ------------------------- validation helpers ------------------------- */

function isAcceptableUrl(value) {
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }
    if (!/^https?:$/.test(parsed.protocol)) return false;
    if (MOCK_MODE) return true;
    return /douyin\.com|iesdouyin\.com/i.test(value);
}

function normalizeUrls(input) {
    const arr = Array.isArray(input) ? input : [input];
    const cleaned = arr.map((u) => String(u).trim()).filter(Boolean);
    return cleaned;
}

function validateUrls(input) {
    const cleaned = normalizeUrls(input);
    if (cleaned.length === 0) {
        const err = new Error('At least one URL is required');
        err.status = 400;
        throw err;
    }
    for (const url of cleaned) {
        if (!isAcceptableUrl(url)) {
            const err = new Error(`Invalid Douyin URL: ${url}`);
            err.status = 400;
            throw err;
        }
    }
    return cleaned;
}

/* ------------------------------ router -------------------------------- */

export function createDouyinRouter({ db, worker, monitor }) {
    const router = express.Router();

    /* ---------------- downloads ---------------- */

    // Single video download
    router.post('/download', (req, res) => {
        try {
            const urls = validateUrls(req.body?.url || req.body?.urls);
            const job = worker.enqueueUrl(urls[0], { creatorId: req.body?.creatorId });
            res.status(201).json({ job });
        } catch (err) {
            httpError(res, err.status || 400, err.message);
        }
    });

    // Batch download
    router.post('/download-batch', (req, res) => {
        try {
            const urls = validateUrls(req.body?.urls);
            if (urls.length > 50) {
                return httpError(res, 400, 'Maximum 50 URLs per batch request');
            }
            const jobs = urls.map((url) => worker.enqueueUrl(url, { creatorId: req.body?.creatorId }));
            res.status(201).json({ jobs, count: jobs.length });
        } catch (err) {
            httpError(res, err.status || 400, err.message);
        }
    });

    /* ---------------- jobs ---------------- */

    router.get('/jobs', (req, res) => {
        const result = listJobs(db, {
            page: req.query.page,
            pageSize: req.query.pageSize,
            status: req.query.status,
        });
        res.json(result);
    });

    router.get('/jobs/:id', (req, res) => {
        const job = getJob(db, req.params.id);
        if (!job) return httpError(res, 404, 'Job not found');
        res.json(job);
    });

    router.post('/jobs/:id/retry', (req, res) => {
        const job = getJob(db, req.params.id);
        if (!job) return httpError(res, 404, 'Job not found');
        const newJob = worker.enqueue(job.video_id, job.source_url);
        res.status(201).json({ job: newJob });
    });

    /* ---------------- history ---------------- */

    router.get('/videos', (req, res) => {
        const result = listVideos(db, {
            search: req.query.search,
            page: req.query.page,
            pageSize: req.query.pageSize,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder,
            status: req.query.status,
        });
        res.json(result);
    });

    router.get('/videos/:id', (req, res) => {
        const video = getVideo(db, req.params.id);
        if (!video) return httpError(res, 404, 'Video not found');
        res.json(video);
    });

    router.delete('/videos/:id', (req, res) => {
        try {
            const video = getVideo(db, req.params.id);
            if (!video) return httpError(res, 404, 'Video not found');
            if (video.file_path && fs.existsSync(video.file_path)) {
                try {
                    fs.unlinkSync(video.file_path);
                } catch {
                    /* file may be locked */
                }
            }
            deleteVideo(db, req.params.id);
            res.json({ success: true, id: req.params.id });
        } catch (err) {
            httpError(res, err.status || 500, err.message);
        }
    });

    // Stream the downloaded file as an attachment.
    router.get('/videos/:id/file', (req, res) => {
        const video = getVideo(db, req.params.id);
        if (!video) return httpError(res, 404, 'Video not found');
        if (!video.file_path || !fs.existsSync(video.file_path)) {
            return httpError(res, 404, 'File not found on disk');
        }
        const safeTitle = String(video.title || 'video')
            .replace(/[^a-zA-Z0-9\s_\-]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 80) || 'video';
        const filename = `${safeTitle}_${video.douyin_video_id}.mp4`;
        res.download(video.file_path, filename);
    });

    /* ---------------- creators ---------------- */

    router.get('/creators', (req, res) => {
        res.json(listCreators(db));
    });

    router.post('/creators', (req, res) => {
        try {
            const { nickname, unique_id, signature, avatar_url, url, is_active } = req.body || {};
            if (!nickname || !String(nickname).trim()) {
                return httpError(res, 400, 'nickname is required');
            }
            const creator = createCreator(db, {
                douyin_id: req.body?.douyin_id,
                unique_id: unique_id || null,
                nickname,
                signature: signature || null,
                avatar_url: avatar_url || null,
                url: url || null,
                is_active: is_active !== undefined ? is_active : 1,
            });
            res.status(201).json(creator);
        } catch (err) {
            httpError(res, err.status || 400, err.message);
        }
    });

    router.get('/creators/:id', (req, res) => {
        const creator = getCreator(db, req.params.id);
        if (!creator) return httpError(res, 404, 'Creator not found');
        res.json(creator);
    });

    router.patch('/creators/:id', (req, res) => {
        try {
            const patch = {};
            if (req.body?.nickname !== undefined) patch.nickname = req.body.nickname;
            if (req.body?.unique_id !== undefined) patch.unique_id = req.body.unique_id;
            if (req.body?.signature !== undefined) patch.signature = req.body.signature;
            if (req.body?.avatar_url !== undefined) patch.avatar_url = req.body.avatar_url;
            if (req.body?.url !== undefined) patch.url = req.body.url;
            if (req.body?.is_active !== undefined) patch.is_active = req.body.is_active ? 1 : 0;
            const creator = updateCreator(db, req.params.id, patch);
            res.json(creator);
        } catch (err) {
            httpError(res, err.status || 400, err.message);
        }
    });

    router.delete('/creators/:id', (req, res) => {
        try {
            const result = deleteCreator(db, req.params.id);
            res.json(result);
        } catch (err) {
            httpError(res, err.status || 404, err.message);
        }
    });

    router.post('/creators/:id/check', async (req, res) => {
        try {
            const creator = getCreator(db, req.params.id);
            if (!creator) return httpError(res, 404, 'Creator not found');
            const result = await monitor.checkCreator(creator.id);
            res.json(result);
        } catch (err) {
            httpError(res, err.status || 500, err.message);
        }
    });

    router.post('/creators/check-all', async (req, res) => {
        try {
            const result = await monitor.checkAllCreators();
            res.json(result);
        } catch (err) {
            httpError(res, err.status || 500, err.message);
        }
    });

    /* ---------------- stats & events ---------------- */

    router.get('/stats', (req, res) => {
        res.json(getStats(db));
    });

    // Server-Sent-Events: live job progress + stats.
    router.get('/events', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.flushHeaders?.();

        const send = (event, data) => {
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch {
                /* client gone */
            }
        };

        send('connected', { ok: true });
        send('stats', getStats(db));

        const onJob = (job) => send('job', job);
        const onStats = (stats) => send('stats', stats);

        worker.emitter.on('job', onJob);
        worker.emitter.on('stats', onStats);

        const ping = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch {
                /* client gone */
            }
        }, 25000);

        req.on('close', () => {
            clearInterval(ping);
            worker.emitter.off('job', onJob);
            worker.emitter.off('stats', onStats);
            try {
                res.end();
            } catch {
                /* already closed */
            }
        });
    });

    return router;
}

export default { createDouyinRouter };
