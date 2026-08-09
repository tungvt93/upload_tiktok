/**
 * douyin-store.js
 * ----------------------------------------------------------------------------
 * SQLite data-access layer for the "Douyin Downloader" feature.
 *
 * Follows the same store pattern as profile-store.js / group-store.js:
 * every function receives the `db` instance and returns plain rows.
 *
 * Tables:
 *   - dy_creators        : registered Douyin creator profiles (monitored)
 *   - dy_videos          : known video metadata
 *   - dy_download_jobs   : one row per download attempt (1:N against videos)
 *
 * Relationships:
 *   dy_creators 1:N dy_videos
 *   dy_videos   1:N dy_download_jobs
 */

import { randomUUID } from 'node:crypto';

const nowIso = () => new Date().toISOString();

const createStoreError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export function initDouyinSchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS dy_creators (
            id             TEXT PRIMARY KEY,
            douyin_id      TEXT,
            unique_id      TEXT,
            nickname       TEXT NOT NULL,
            signature      TEXT,
            avatar_url     TEXT,
            url            TEXT,
            is_active      INTEGER NOT NULL DEFAULT 1,
            last_checked_at TEXT,
            created_at     TEXT NOT NULL,
            updated_at     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dy_videos (
            id               TEXT PRIMARY KEY,
            douyin_video_id  TEXT NOT NULL,
            title            TEXT NOT NULL,
            description      TEXT,
            author           TEXT NOT NULL,
            author_avatar    TEXT,
            duration         INTEGER NOT NULL DEFAULT 0,
            cover_url        TEXT,
            published_at     TEXT,
            source_url       TEXT,
            file_path        TEXT,
            file_size        INTEGER,
            mime_type        TEXT,
            creator_id       TEXT,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL,
            FOREIGN KEY (creator_id) REFERENCES dy_creators(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS dy_download_jobs (
            id          TEXT PRIMARY KEY,
            video_id    TEXT NOT NULL,
            source_url  TEXT,
            status      TEXT NOT NULL DEFAULT 'PENDING',
            progress    INTEGER NOT NULL DEFAULT 0,
            error       TEXT,
            file_path   TEXT,
            started_at  TEXT,
            finished_at TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            FOREIGN KEY (video_id) REFERENCES dy_videos(id) ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_dy_creators_douyin_id
            ON dy_creators (douyin_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_dy_videos_douyin_video_id
            ON dy_videos (douyin_video_id);
        CREATE INDEX IF NOT EXISTS idx_dy_videos_creator_id
            ON dy_videos (creator_id);
        CREATE INDEX IF NOT EXISTS idx_dy_videos_author
            ON dy_videos (author);
        CREATE INDEX IF NOT EXISTS idx_dy_download_jobs_video_id
            ON dy_download_jobs (video_id);
        CREATE INDEX IF NOT EXISTS idx_dy_download_jobs_status
            ON dy_download_jobs (status);
    `);
}

/* ------------------------------------------------------------------ */
/* Creators                                                            */
/* ------------------------------------------------------------------ */

export function listCreators(db) {
    return db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM dy_videos v WHERE v.creator_id = c.id) AS video_count,
               (SELECT COUNT(*) FROM dy_videos v
                 JOIN dy_download_jobs j ON j.video_id = v.id
                WHERE v.creator_id = c.id AND j.status = 'COMPLETED') AS downloaded_count
        FROM dy_creators c
        ORDER BY c.created_at DESC
    `).all();
}

export function getCreator(db, id) {
    return db.prepare('SELECT * FROM dy_creators WHERE id = ?').get(id);
}

export function getCreatorByDouyinId(db, douyinId) {
    return db.prepare('SELECT * FROM dy_creators WHERE douyin_id = ?').get(douyinId);
}

export function createCreator(db, { douyin_id, unique_id, nickname, signature, avatar_url, url, is_active = 1 }) {
    const trimmedNickname = (nickname || '').trim();
    if (!trimmedNickname) throw createStoreError('nickname is required', 400);

    const id = randomUUID();
    const ts = nowIso();
    try {
        db.prepare(`
            INSERT INTO dy_creators
                (id, douyin_id, unique_id, nickname, signature, avatar_url, url, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            douyin_id || null,
            unique_id || null,
            trimmedNickname,
            signature || null,
            avatar_url || null,
            url || null,
            is_active ? 1 : 0,
            ts,
            ts
        );
    } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw createStoreError('This creator is already registered', 409);
        }
        throw createStoreError('Could not create creator', 500);
    }
    return getCreator(db, id);
}

export function updateCreator(db, id, patch) {
    const existing = getCreator(db, id);
    if (!existing) throw createStoreError('Creator not found', 404);

    const next = { ...existing, ...patch };
    db.prepare(`
        UPDATE dy_creators
        SET douyin_id = ?, unique_id = ?, nickname = ?, signature = ?,
            avatar_url = ?, url = ?, is_active = ?, updated_at = ?
        WHERE id = ?
    `).run(
        next.douyin_id ?? null,
        next.unique_id ?? null,
        next.nickname ?? '',
        next.signature ?? null,
        next.avatar_url ?? null,
        next.url ?? null,
        next.is_active ? 1 : 0,
        nowIso(),
        id
    );
    return getCreator(db, id);
}

export function deleteCreator(db, id) {
    const existing = getCreator(db, id);
    if (!existing) throw createStoreError('Creator not found', 404);
    // Videos keep the author text but lose the creator link (ON DELETE SET NULL)
    db.prepare('DELETE FROM dy_creators WHERE id = ?').run(id);
    return { success: true, id };
}

export function setCreatorChecked(db, id) {
    db.prepare('UPDATE dy_creators SET last_checked_at = ?, updated_at = ? WHERE id = ?')
        .run(nowIso(), nowIso(), id);
}

export function listActiveCreators(db) {
    return db.prepare('SELECT * FROM dy_creators WHERE is_active = 1 ORDER BY created_at DESC').all();
}

/* ------------------------------------------------------------------ */
/* Videos                                                              */
/* ------------------------------------------------------------------ */

export function getVideo(db, id) {
    return db.prepare('SELECT * FROM dy_videos WHERE id = ?').get(id);
}

export function getVideoByDouyinId(db, douyinVideoId) {
    return db.prepare('SELECT * FROM dy_videos WHERE douyin_video_id = ?').get(douyinVideoId);
}

export function upsertVideo(db, {
    douyin_video_id,
    title,
    description,
    author,
    author_avatar,
    duration,
    cover_url,
    published_at,
    source_url,
    creator_id,
    file_path = null,
    file_size = null,
    mime_type = null,
}) {
    const existing = getVideoByDouyinId(db, douyin_video_id);
    const ts = nowIso();
    if (existing) {
        // Prefer the newest metadata, keep the existing file if we already have one.
        db.prepare(`
            UPDATE dy_videos
            SET title = ?, description = ?, author = ?, author_avatar = ?, duration = ?,
                cover_url = ?, published_at = ?, source_url = ?, creator_id = ?,
                file_path = COALESCE(?, file_path),
                file_size = COALESCE(?, file_size),
                mime_type = COALESCE(?, mime_type),
                updated_at = ?
            WHERE id = ?
        `).run(
            title ?? existing.title,
            description ?? existing.description,
            author ?? existing.author,
            author_avatar ?? existing.author_avatar,
            duration ?? existing.duration,
            cover_url ?? existing.cover_url,
            published_at ?? existing.published_at,
            source_url ?? existing.source_url,
            creator_id !== undefined ? creator_id : existing.creator_id,
            file_path,
            file_size,
            mime_type,
            ts,
            existing.id
        );
        return getVideo(db, existing.id);
    }

    const id = randomUUID();
    db.prepare(`
        INSERT INTO dy_videos
            (id, douyin_video_id, title, description, author, author_avatar, duration,
             cover_url, published_at, source_url, file_path, file_size, mime_type, creator_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        douyin_video_id,
        title || 'Untitled video',
        description ?? null,
        author || 'Unknown',
        author_avatar ?? null,
        duration || 0,
        cover_url ?? null,
        published_at ?? null,
        source_url ?? null,
        file_path ?? null,
        file_size ?? null,
        mime_type ?? null,
        creator_id ?? null,
        ts,
        ts
    );
    return getVideo(db, id);
}

export function updateVideoFile(db, id, { file_path, file_size, mime_type }) {
    db.prepare('UPDATE dy_videos SET file_path = ?, file_size = ?, mime_type = ?, updated_at = ? WHERE id = ?')
        .run(file_path ?? null, file_size ?? null, mime_type ?? null, nowIso(), id);
}

/**
 * List videos with their latest download status.
 * Supports search, pagination and sorting.
 */
export function listVideos(db, {
    search = '',
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    status = '',
}) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (safePage - 1) * safeSize;

    const ALLOWED_SORT = new Set([
        'created_at', 'title', 'author', 'duration', 'status', 'downloaded_at', 'published_at',
    ]);
    const sortCol = ALLOWED_SORT.has(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];

    if (search && String(search).trim()) {
        where.push('(v.title LIKE ? OR v.author LIKE ? OR v.douyin_video_id LIKE ?)');
        const like = `%${String(search).trim()}%`;
        params.push(like, like, like);
    }
    if (status && String(status).trim() && status !== 'ALL') {
        where.push('latest.status = ?');
        params.push(String(status).trim());
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = db.prepare(`
        SELECT COUNT(*) AS total
        FROM dy_videos v
        LEFT JOIN (
            SELECT j.video_id, j.status, j.created_at AS downloaded_at
            FROM dy_download_jobs j
            WHERE j.rowid IN (
                SELECT MAX(rowid) FROM dy_download_jobs GROUP BY video_id
            )
        ) latest ON latest.video_id = v.id
        ${whereSql}
    `).get(...params);

    const rows = db.prepare(`
        SELECT
            v.*,
            latest.status,
            latest.downloaded_at,
            c.nickname AS creator_name
        FROM dy_videos v
        LEFT JOIN (
            SELECT j.video_id, j.status, j.created_at AS downloaded_at
            FROM dy_download_jobs j
            WHERE j.rowid IN (
                SELECT MAX(rowid) FROM dy_download_jobs GROUP BY video_id
            )
        ) latest ON latest.video_id = v.id
        LEFT JOIN dy_creators c ON c.id = v.creator_id
        ${whereSql}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ? OFFSET ?
    `).all(...params, safeSize, offset);

    return {
        data: rows,
        pagination: {
            page: safePage,
            pageSize: safeSize,
            total: count.total,
            totalPages: Math.max(1, Math.ceil(count.total / safeSize)),
        },
    };
}

export function deleteVideo(db, id) {
    const existing = getVideo(db, id);
    if (!existing) throw createStoreError('Video not found', 404);
    db.prepare('DELETE FROM dy_videos WHERE id = ?').run(id);
    return { success: true, id };
}

/* ------------------------------------------------------------------ */
/* Download jobs                                                       */
/* ------------------------------------------------------------------ */

export function createJob(db, { video_id, source_url, status = 'PENDING' }) {
    const id = randomUUID();
    const ts = nowIso();
    db.prepare(`
        INSERT INTO dy_download_jobs (id, video_id, source_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, video_id, source_url || null, status, ts, ts);
    return getJob(db, id);
}

export function getJob(db, id) {
    return db.prepare(`
        SELECT j.*, v.title, v.author, v.cover_url, v.douyin_video_id
        FROM dy_download_jobs j
        LEFT JOIN dy_videos v ON v.id = j.video_id
        WHERE j.id = ?
    `).get(id);
}

export function updateJob(db, id, patch) {
    const sets = [];
    const params = [];
    const allowed = ['status', 'progress', 'error', 'file_path', 'started_at', 'finished_at', 'video_id'];
    for (const key of allowed) {
        if (patch[key] !== undefined) {
            sets.push(`${key} = ?`);
            params.push(patch[key]);
        }
    }
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    db.prepare(`UPDATE dy_download_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getJob(db, id);
}

export function listJobs(db, { page = 1, pageSize = 20, status = '' } = {}) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (safePage - 1) * safeSize;

    const where = [];
    const params = [];
    if (status && status !== 'ALL') {
        where.push('status = ?');
        params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = db.prepare(`SELECT COUNT(*) AS total FROM dy_download_jobs ${whereSql}`).get(...params);
    const rows = db.prepare(`
        SELECT j.*, v.title, v.author, v.cover_url, v.douyin_video_id
        FROM dy_download_jobs j
        LEFT JOIN dy_videos v ON v.id = j.video_id
        ${whereSql}
        ORDER BY j.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, safeSize, offset);

    return {
        data: rows,
        pagination: {
            page: safePage,
            pageSize: safeSize,
            total: count.total,
            totalPages: Math.max(1, Math.ceil(count.total / safeSize)),
        },
    };
}

export function countPendingJobs(db) {
    return db.prepare("SELECT COUNT(*) AS total FROM dy_download_jobs WHERE status IN ('PENDING','PROCESSING')").get().total;
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function getStats(db) {
    const totalVideos = db.prepare('SELECT COUNT(*) AS total FROM dy_videos').get().total;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const downloadedToday = db.prepare(
        "SELECT COUNT(*) AS total FROM dy_download_jobs WHERE status = 'COMPLETED' AND finished_at >= ?"
    ).get(todayStart.toISOString()).total;

    const activeCreators = db.prepare('SELECT COUNT(*) AS total FROM dy_creators WHERE is_active = 1').get().total;
    const totalCreators = db.prepare('SELECT COUNT(*) AS total FROM dy_creators').get().total;

    const failedDownloads = db.prepare("SELECT COUNT(*) AS total FROM dy_download_jobs WHERE status = 'FAILED'").get().total;
    const pendingJobs = db.prepare("SELECT COUNT(*) AS total FROM dy_download_jobs WHERE status IN ('PENDING','PROCESSING')").get().total;

    const totalDownloaded = db.prepare("SELECT COUNT(*) AS total FROM dy_download_jobs WHERE status = 'COMPLETED'").get().total;

    return {
        totalVideos,
        downloadedToday,
        activeCreators,
        totalCreators,
        failedDownloads,
        pendingJobs,
        totalDownloaded,
        totalStorageBytes: db.prepare('SELECT COALESCE(SUM(file_size), 0) AS total FROM dy_videos').get().total,
    };
}

export default {
    initDouyinSchema,
    listCreators,
    getCreator,
    getCreatorByDouyinId,
    createCreator,
    updateCreator,
    deleteCreator,
    setCreatorChecked,
    listActiveCreators,
    getVideo,
    getVideoByDouyinId,
    upsertVideo,
    updateVideoFile,
    listVideos,
    deleteVideo,
    createJob,
    getJob,
    updateJob,
    listJobs,
    countPendingJobs,
    getStats,
};
