/**
 * douyin-scheduler.js
 * ----------------------------------------------------------------------------
 * Creator monitoring scheduler.
 *
 * Every `MONITOR_INTERVAL_MINUTES` (default 30) the monitor scans all *active*
 * registered creators, fetches their latest videos from Douyin and auto-creates
 * download jobs for any video we have not seen before.
 */

import { fetchCreatorRecentVideos } from './douyin-client.js';
import {
    getCreator,
    listActiveCreators,
    getVideoByDouyinId,
    upsertVideo,
    setCreatorChecked,
} from './douyin-store.js';

const DEFAULT_INTERVAL_MINUTES = 30;
const checkDelayMs = () => 500 + Math.floor(Math.random() * 800);

export function createCreatorMonitor({ db, worker }) {
    let timer = null;
    let running = false;

    /**
     * Check one creator for new videos. Returns a result summary.
     */
    const checkCreator = async (creatorId) => {
        const creator = getCreator(db, creatorId);
        if (!creator) {
            const err = new Error('Creator not found');
            err.status = 404;
            throw err;
        }

        const url = (creator.url || '').trim();
        if (!/^https?:\/\//i.test(url) || !/douyin\.com|iesdouyin\.com/i.test(url)) {
            return {
                creatorId,
                checked: false,
                reason: 'Creator has no valid Douyin URL configured',
                found: 0,
                created: 0,
                skipped: 0,
            };
        }

        const videos = await fetchCreatorRecentVideos(url);
        const summary = { creatorId, checked: true, found: videos.length, created: 0, skipped: 0, errors: [] };

        for (const meta of videos) {
            try {
                const existing = getVideoByDouyinId(db, meta.videoId);
                if (existing) {
                    summary.skipped += 1;
                    continue;
                }
                const video = upsertVideo(db, {
                    douyin_video_id: meta.videoId,
                    title: meta.title,
                    description: meta.description,
                    author: meta.author,
                    author_avatar: meta.authorAvatar,
                    duration: meta.duration,
                    cover_url: meta.coverUrl,
                    published_at: meta.publishedAt,
                    source_url: meta.sourceUrl,
                    creator_id: creator.id,
                });
                // Enqueue against the canonical video URL so the worker resolves
                // the exact same video (and its playable address) on re-fetch.
                const videoUrl = `https://www.douyin.com/video/${meta.videoId}`;
                worker.enqueue(video.id, videoUrl);
                summary.created += 1;
            } catch (err) {
                summary.errors.push(`${meta.videoId}: ${err.message}`);
            }
        }

        try {
            setCreatorChecked(db, creator.id);
        } catch {
            /* non-fatal */
        }

        return summary;
    };

    /**
     * Check every active creator sequentially.
     */
    const checkAllCreators = async () => {
        if (running) return { running: true };
        running = true;
        const creators = listActiveCreators(db);
        const results = [];
        try {
            for (const creator of creators) {
                try {
                    const result = await checkCreator(creator.id);
                    results.push({ name: creator.nickname, ...result });
                } catch (err) {
                    results.push({ name: creator.nickname, creatorId: creator.id, checked: false, error: err.message });
                }
                await new Promise((r) => setTimeout(r, checkDelayMs()));
            }
            return { checkedCreators: creators.length, results };
        } finally {
            running = false;
        }
    };

    const start = (intervalMinutes) => {
        if (timer) return;
        const minutes = Math.max(5, Number(intervalMinutes) || DEFAULT_INTERVAL_MINUTES);
        const ms = minutes * 60 * 1000;
        console.log(`[DouyinMonitor] Creator monitoring started (every ${minutes} minutes)`);

        // Initial scan shortly after boot.
        const initial = setTimeout(() => {
            checkAllCreators().catch((err) => console.error('[DouyinMonitor] Initial check failed:', err.message));
        }, 10000);

        timer = setInterval(() => {
            checkAllCreators().catch((err) => console.error('[DouyinMonitor] Scheduled check failed:', err.message));
        }, ms);

        return () => {
            clearTimeout(initial);
            clearInterval(timer);
            timer = null;
        };
    };

    const stop = () => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    };

    return { checkCreator, checkAllCreators, start, stop };
}

export default { createCreatorMonitor };
