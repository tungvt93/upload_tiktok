import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files';

function extractGoogleApiDetail(err) {
    const d = err?.response?.data;
    if (!d) return err?.message || String(err);
    if (typeof d === 'string') return d;
    if (d.error && typeof d.error === 'object') {
        const parts = [d.error.message, d.error.status].filter(Boolean);
        if (d.error.errors?.length) {
            for (const e of d.error.errors) {
                if (e?.reason) parts.push(`reason=${e.reason}`);
                if (e?.message) parts.push(e.message);
            }
        }
        return parts.filter(Boolean).join(' | ');
    }
    try {
        return JSON.stringify(d);
    } catch (_) {
        return String(d);
    }
}

function wrapDriveHttpError(err, operation) {
    const status = err?.response?.status;
    const detail = extractGoogleApiDetail(err);

    if (status === 403) {
        const hint =
            'Kiểm tra: (1) Google Cloud Console → APIs & Services → bật "Google Drive API". ' +
            '(2) Credentials → API key → Application restrictions: chọn "None" hoặc "IP addresses" gồm IP máy chạy backend — tránh "HTTP referrers" vì request từ server không có referrer. ' +
            '(3) API restrictions: thêm "Google Drive API" hoặc tạm bỏ giới hạn API để thử. ' +
            '(4) Trên Drive: thư mục gốc + file video → Share → "Anyone with the link" → Viewer (không chỉ trong tổ chức).';
        const e = new Error(`Drive ${operation}: 403 Forbidden — ${detail}. ${hint}`);
        e.status = 502;
        return e;
    }
    if (status === 404) {
        const e = new Error(
            `Drive ${operation}: 404 — ${detail}. Folder/file ID có thể sai, hoặc tài khoản Google không có quyền xem (chưa share link).`
        );
        e.status = 502;
        return e;
    }
    if (status === 400) {
        const e = new Error(`Drive ${operation}: 400 — ${detail}. Kiểm tra lại ID thư mục gốc (copy từ URL /folders/...).`);
        e.status = 502;
        return e;
    }
    const e = new Error(`Drive ${operation}: HTTP ${status || '?'} — ${detail}`);
    e.status = 502;
    return e;
}

/** Trích ID từ URL Drive hoặc trả về chuỗi gốc nếu đã là ID. */
export function normalizeDriveFolderId(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const m =
        s.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
        s.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        s.match(/^([a-zA-Z0-9_-]{10,})$/);
    if (m) return m[1];
    return s.replace(/[^a-zA-Z0-9_-]/g, '') === s ? s : '';
}

function isVideoFile(file) {
    const mime = String(file.mimeType || '');
    if (mime.startsWith('video/')) return true;
    const n = String(file.name || '').toLowerCase();
    return /\.(mp4|mov|webm|mkv|m4v)$/.test(n);
}

function isDriveFolder(file) {
    return file.mimeType === 'application/vnd.google-apps.folder';
}

async function driveListChildren(apiKey, parentId, pageToken) {
    const q = `'${parentId}' in parents and trashed = false`;
    const params = new URLSearchParams({
        q,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageSize: '1000',
        key: apiKey
    });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${DRIVE_FILES_BASE}?${params.toString()}`;
    try {
        const { data } = await axios.get(url, { timeout: 120000 });
        return {
            files: Array.isArray(data.files) ? data.files : [],
            nextPageToken: data.nextPageToken || null
        };
    } catch (err) {
        throw wrapDriveHttpError(err, 'files.list');
    }
}

async function listDirectChildren(apiKey, parentId) {
    const all = [];
    let pageToken = null;
    do {
        const { files, nextPageToken } = await driveListChildren(apiKey, parentId, pageToken);
        pageToken = nextPageToken;
        all.push(...files);
    } while (pageToken);
    return all;
}

async function listVideoFilesRecursive(apiKey, folderId, out = []) {
    let pageToken = null;
    do {
        const { files, nextPageToken } = await driveListChildren(apiKey, folderId, pageToken);
        pageToken = nextPageToken;
        for (const f of files) {
            if (isDriveFolder(f)) {
                await listVideoFilesRecursive(apiKey, f.id, out);
            } else if (isVideoFile(f)) {
                out.push(f);
            }
        }
    } while (pageToken);
    return out;
}

function safeProfileDirSegment(name) {
    const s = String(name || '').trim() || 'profile';
    return s.replace(/[/\\?\*:|"<>]/g, '_').replace(/\.\./g, '_');
}

async function downloadDriveFile(apiKey, fileId, destPath) {
    const url = `${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
    let writer = null;
    try {
        writer = fs.createWriteStream(destPath);
        const res = await axios.get(url, {
            responseType: 'stream',
            timeout: 0,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: (s) => s === 200
        });
        await new Promise((resolve, reject) => {
            res.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
            res.data.on('error', reject);
        });
    } catch (err) {
        try {
            if (writer) writer.close();
        } catch (_) {}
        try {
            fs.unlinkSync(destPath);
        } catch (_) {}
        throw wrapDriveHttpError(err, 'files.download (alt=media)');
    }
}

/**
 * Đồng bộ video từ thư mục gốc Drive (các subfolder trùng tên profile) → uploads/<tên_profile>/
 */
export async function syncGoogleDriveToUploads({
    apiKey,
    rootFolderId,
    profiles,
    uploadsDir,
    profileIds = null
}) {
    const root = normalizeDriveFolderId(rootFolderId);
    if (!apiKey || !String(apiKey).trim()) {
        throw Object.assign(new Error('Thiếu Google Drive API key (cấu hình hoặc biến môi trường GOOGLE_DRIVE_API_KEY).'), {
            status: 400
        });
    }
    if (!root) {
        throw Object.assign(new Error('Thiếu hoặc sai ID thư mục gốc Drive (googleDriveRootFolderId / GOOGLE_DRIVE_ROOT_FOLDER_ID).'), {
            status: 400
        });
    }

    const key = String(apiKey).trim();
    const direct = await listDirectChildren(key, root);
    const directFolderByName = new Map();
    for (const f of direct) {
        if (isDriveFolder(f)) directFolderByName.set(f.name, f.id);
    }

    let list = profiles;
    if (Array.isArray(profileIds) && profileIds.length > 0) {
        const set = new Set(profileIds.map(String));
        list = profiles.filter((p) => set.has(String(p.id)));
    }

    const summary = [];

    for (const profile of list) {
        const name = String(profile.name || '').trim();
        const folderId = directFolderByName.get(name);
        const row = {
            profileId: profile.id,
            profileName: name,
            folderFound: Boolean(folderId),
            downloaded: [],
            skipped: [],
            errors: []
        };
        summary.push(row);

        if (!folderId) {
            row.errors.push(`Không tìm thấy thư mục Drive trùng tên "${name}" trong thư mục gốc.`);
            continue;
        }

        const videoFiles = await listVideoFilesRecursive(key, folderId, []);
        const destDir = path.join(uploadsDir, safeProfileDirSegment(name));
        fs.mkdirSync(destDir, { recursive: true });

        for (const vf of videoFiles) {
            const baseName = path.basename(String(vf.name || 'video'));
            const destPath = path.join(destDir, baseName);
            try {
                await downloadDriveFile(key, vf.id, destPath);
                row.downloaded.push(baseName);
            } catch (e) {
                const msg = e?.response?.data ? JSON.stringify(e.response.data) : e?.message || String(e);
                row.errors.push(`${baseName}: ${msg}`);
            }
        }
    }

    return { summary, rootFolderId: root };
}
