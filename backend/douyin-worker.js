/**
 * douyin-worker.js
 * ----------------------------------------------------------------------------
 * In-process asynchronous download queue.
 *
 * A lightweight BullMQ-style worker built on Node's EventEmitter so the feature
 * works without extra infrastructure (the host app is Express + SQLite). Each
 * job is processed with a bounded concurrency and emits progress events that
 * the SSE endpoint streams to the browser.
 *
 * Job lifecycle:
 *   QUEUED -> PROCESSING (0..100) -> COMPLETED | FAILED
 */

import { EventEmitter } from 'node:events';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { fetchVideoMetadata, downloadVideo } from './douyin-client.js';
import {
    upsertVideo,
    updateVideoFile,
    getVideo,
    getVideoByDouyinId,
    createJob,
    getJob,
    updateJob,
    getStats,
} from './douyin-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONCURRENCY = 2;

export function createDouyinWorker({ db, storageDir, concurrency }) {
    const emitter = new EventEmitter();
    const maxConcurrency = Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY);
    const pending = []; // queued job ids (FIFO)
    const inFlight = new Set(); // currently processing job ids
    const processingVideoIds = new Set(); // guard against duplicate concurrent downloads
    let drainTimer = null;

    const broadcast = (event, payload) => emitter.emit(event, payload);
    const emitJob = (job) => broadcast('job', job);
    const emitStats = () => broadcast('stats', getStats(db));

    /* ---------------- helpers ---------------- */

    const resolveStoragePath = () => {
        const root = storageDir || path.join(__dirname, '..', 'downloads');
        fs.mkdirSync(root, { recursive: true });
        return root;
    };

    const safeUpdate = (id, patch) => {
        try {
            return updateJob(db, id, patch);
        } catch (err) {
            console.error(`[DouyinWorker] Failed to update job ${id}:`, err.message);
            return null;
        }
    };

    /**
     * Create (or reuse) the real video record for a resolved item and point the
     * job at it. A placeholder video may have been created synchronously by the
     * API layer before we knew the real douyin_video_id; we re-link and clean up.
     */
    const linkVideo = (job, metadata) => {
        // If the job points at a placeholder record, reuse its creator linkage so
        // creator-monitored downloads stay attributed to the right creator.
        const placeholder = getVideo(db, job.video_id);
        const creatorId = placeholder?.creator_id || undefined;

        const video = upsertVideo(db, {
            douyin_video_id: metadata.videoId,
            title: metadata.title,
            description: metadata.description,
            author: metadata.author,
            author_avatar: metadata.authorAvatar,
            duration: metadata.duration,
            cover_url: metadata.coverUrl,
            published_at: metadata.publishedAt,
            source_url: metadata.sourceUrl || job.source_url,
            creator_id: creatorId,
        });

        if (video.id !== job.video_id) {
            // Re-link job to the canonical video record and drop the placeholder.
            updateJob(db, job.id, { video_id: video.id });
            try {
                if (placeholder && String(placeholder.douyin_video_id).startsWith('pending_')) {
                    db.prepare('DELETE FROM dy_videos WHERE id = ?').run(job.video_id);
                }
            } catch {
                /* placeholder may already be gone */
            }
        }
        return getJob(db, job.id);
    };

    /* ---------------- job processing ---------------- */

    const processJob = async (jobId) => {
        inFlight.add(jobId);
        const job = getJob(db, jobId);
        if (!job) {
            inFlight.delete(jobId);
            return;
        }

        safeUpdate(jobId, { status: 'PROCESSING', progress: 1, started_at: new Date().toISOString(), error: null });
        emitJob(getJob(db, jobId));

        try {
            const videoId = job.video_id;
            const video = getVideo(db, videoId);

            // 1. Resolve URL + fetch metadata (this also resolves short links).
            const metadata = await fetchVideoMetadata(job.source_url || video?.source_url);

            // 2. Ensure canonical video record exists and re-link if needed.
            let current = getJob(db, jobId);
            current = linkVideo(current, metadata);
            const canonicalVideo = getVideo(db, current.video_id);

            // Guard: if the canonical video is already downloaded, mark as COMPLETED.
            if (canonicalVideo?.file_path && fs.existsSync(canonicalVideo.file_path) &&
                getVideoByDouyinId(db, metadata.videoId)?.id === canonicalVideo.id) {
                safeUpdate(jobId, {
                    status: 'COMPLETED',
                    progress: 100,
                    file_path: canonicalVideo.file_path,
                    finished_at: new Date().toISOString(),
                });
                emitJob(getJob(db, jobId));
                emitStats();
                return;
            }

            if (!metadata.downloadUrl) {
                throw new Error('No playable video address could be extracted');
            }

            // 3. Download to storage.
            const safeName = sanitizeFileSegment(metadata.videoId || 'video');
            const destDir = path.join(resolveStoragePath(), safeName);
            const destPath = path.join(destDir, `${safeName}.mp4`);

            if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
                const result = await downloadVideo(metadata.downloadUrl, destPath, {
                    onProgress: (percent) => {
                        safeUpdate(jobId, { progress: percent });
                        emitJob(getJob(db, jobId));
                    },
                });
                updateVideoFile(db, canonicalVideo.id, {
                    file_path: result.filePath,
                    file_size: result.fileSize,
                    mime_type: result.mimeType,
                });
            } else {
                updateVideoFile(db, canonicalVideo.id, {
                    file_path: destPath,
                    file_size: fs.statSync(destPath).size,
                    mime_type: 'video/mp4',
                });
            }

            // 4. Mark complete.
            const finalVideo = getVideo(db, canonicalVideo.id);
            safeUpdate(jobId, {
                status: 'COMPLETED',
                progress: 100,
                file_path: finalVideo?.file_path || destPath,
                finished_at: new Date().toISOString(),
            });
            emitJob(getJob(db, jobId));
            emitStats();
        } catch (err) {
            console.error(`[DouyinWorker] Job ${jobId} failed:`, err.message);
            safeUpdate(jobId, {
                status: 'FAILED',
                error: err.message || 'Unknown download error',
                finished_at: new Date().toISOString(),
            });
            emitJob(getJob(db, jobId));
            emitStats();
        } finally {
            inFlight.delete(jobId);
        }
    };

    /* ---------------- queue ---------------- */

    const pump = () => {
        if (drainTimer) {
            clearTimeout(drainTimer);
            drainTimer = null;
        }
        while (pending.length > 0 && inFlight.size < maxConcurrency) {
            const jobId = pending.shift();
            if (!jobId || inFlight.has(jobId)) continue;
            const job = getJob(db, jobId);
            if (!job || ['COMPLETED', 'FAILED'].includes(job.status)) continue;
            // If the same video is already downloading, skip this redundant job.
            const videoId = job.video_id;
            if (videoId && processingVideoIds.has(videoId)) continue;
            if (videoId) processingVideoIds.add(videoId);
            processJob(jobId)
                .catch(() => {})
                .finally(() => {
                    if (videoId) processingVideoIds.delete(videoId);
                    drainTimer = setTimeout(pump, 0);
                });
        }
    };

    const enqueue = (videoId, sourceUrl) => {
        const job = createJob(db, { video_id: videoId, source_url: sourceUrl, status: 'QUEUED' });
        pending.push(job.id);
        setImmediate(pump);
        emitJob(job);
        emitStats();
        return job;
    };

    /**
     * Enqueue a download for a URL that has not been resolved yet. Creates a
     * placeholder video row so the client receives a job id synchronously; the
     * worker resolves the real metadata and re-links the video.
     */
    const enqueueUrl = (url, { creatorId } = {}) => {
        const placeholder = upsertVideo(db, {
            douyin_video_id: `pending_${randomUUID()}`,
            title: url,
            description: null,
            author: 'Pending',
            duration: 0,
            cover_url: null,
            published_at: null,
            source_url: url,
            creator_id: creatorId,
        });
        return enqueue(placeholder.id, url);
    };

    const activeCount = () => inFlight.size;
    const queuedCount = () => pending.length;

    return { enqueue, enqueueUrl, emitter, activeCount, queuedCount };
}

function sanitizeFileSegment(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 64) || 'video';
}

export default { createDouyinWorker };
