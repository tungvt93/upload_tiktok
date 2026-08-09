/**
 * douyin-client.js
 * ----------------------------------------------------------------------------
 * Douyin integration client.
 *
 * Responsibilities:
 *   1. Resolve short links (https://v.douyin.com/xxxx) to the full share page.
 *   2. Fetch the share page and extract video metadata:
 *        - video id, title, author, publish date, duration, cover image
 *   3. Stream the raw video to local storage.
 *
 * Douyin's share page embeds a `window._ROUTER_DATA` blob which contains the
 * full item payload (play address, cover, duration, author...). We parse that
 * first and fall back to Open Graph meta tags when it is unavailable.
 *
 * All HTTP goes through the reusable `DouyinHttpClient` (see
 * backend/douyin-http-client.js), which injects DOUYIN_COOKIES + browser-like
 * headers, supports HTTP_PROXY / HTTPS_PROXY, and applies timeouts, retries and
 * rate limiting. Configuration is centralised in backend/config/douyin.config.js.
 *
 * Environment knobs (full list in the config module):
 *   - DOUYIN_COOKIES    : authenticated session cookies ("sessionid=...; ttwid=...")
 *   - HTTP_PROXY / HTTPS_PROXY : optional proxy URL
 *   - DOUYIN_MOCK       : when "1", never touches the network (demo/testing mode)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DouyinHttpClient } from './douyin-http-client.js';
import { loadDouyinConfig } from './config/douyin.config.js';
import { DouyinError } from './douyin-errors.js';
import { parseDouyinUrl, extractVideoId, normalizeDouyinUrl } from './src/douyin-url-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_MODE = process.env.DOUYIN_MOCK === '1';
const DUMMY_VIDEO_PATH = path.join(__dirname, '..', 'dummy_videos', 'dummy_upload.mp4');

/* ------------------------------------------------------------------ */
/* HTTP client                                                         */
/* ------------------------------------------------------------------ */

// Reusable authenticated client: cookies + browser headers + proxy + retries +
// timeouts + rate limiting. Constructed once from the central config module.
const config = loadDouyinConfig();
const httpClient = new DouyinHttpClient({ config });

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */

// URL parsing is delegated to the shared, fully-typed parser in
// backend/src/douyin-url-parser.js (with declarations in
// douyin-url-parser.d.ts and tests in backend/tests/douyin-url-parser.test.ts).
// It understands short links, /video, /note, /user and modal_id pages, and
// returns a normalized { id, type, normalizedUrl } result.
export { extractVideoId, normalizeDouyinUrl } from './src/douyin-url-parser.js';

/**
 * Resolve a URL to the canonical Douyin page used for metadata fetching.
 *
 * - Already-canonical video/note URLs (including `/jingxuan?modal_id=`,
 *   `/discover?modal_id=` and `/user/...?modal_id=` pages) are normalized
 *   directly by the shared parser — this preserves the `modal_id` that used to
 *   be stripped when only the query string was removed.
 * - Short share links (https://v.douyin.com/xxxx) are followed manually
 *   (axios `maxRedirects: 0`) into the real
 *   https://www.douyin.com/video/{id} page.
 */
export async function resolveShortUrl(rawUrl) {
    let url = String(rawUrl || '').trim();
    if (!url) throw new Error('URL is required');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    // Fast path: a canonical video/note URL (direct or via modal_id) can be
    // normalized without any HTTP round-trip.
    const parsed = parseDouyinUrl(url);
    if (parsed.type === 'video' || parsed.type === 'note') {
        return parsed.normalizedUrl;
    }

    const visited = new Set();
    for (let i = 0; i < 10; i++) {
        if (visited.has(url)) break;
        visited.add(url);

        try {
            const resp = await httpClient.get(url, { maxRedirects: 0, validateStatus: (s) => s < 400 });
            const finalUrl = resp.config?.url || url;
            const resolved = parseDouyinUrl(finalUrl);
            if (resolved.type === 'video' || resolved.type === 'note') return resolved.normalizedUrl;
            return normalizeDouyinUrl(finalUrl);
        } catch (err) {
            // Let typed auth/rate-limit exceptions bubble up unchanged so callers
            // can surface a meaningful "cookie expired" style error.
            if (err instanceof DouyinError) throw err;
            const status = err.response?.status;
            const location = err.response?.headers?.location;
            if (status >= 300 && status < 400 && location) {
                url = new URL(location, url).toString();
                continue;
            }
            if (/douyin\.com/.test(url)) {
                // Already a douyin URL — good enough to proceed with the share page.
                return normalizeDouyinUrl(url);
            }
            throw new Error(`Failed to resolve URL: ${err.message}`);
        }
    }
    return normalizeDouyinUrl(url);
}

/* ------------------------------------------------------------------ */
/* Share page parsing                                                  */
/* ------------------------------------------------------------------ */

function extractRouterData(html) {
    const candidates = [
        /window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
        /window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i,
    ];
    for (const re of candidates) {
        const match = html.match(re);
        if (match) {
            try {
                return JSON.parse(match[1]);
            } catch {
                /* try next candidate */
            }
        }
    }

    // Fallback: slice between the first "{" after _ROUTER_DATA and "</script>".
    const marker = '_ROUTER_DATA';
    const idx = html.indexOf(marker);
    if (idx !== -1) {
        const start = html.indexOf('{', idx);
        const end = html.indexOf('</script>', idx);
        if (start !== -1 && end !== -1 && end > start) {
            const raw = html.slice(start, end).trim().replace(/;\s*$/, '');
            try {
                return JSON.parse(raw);
            } catch {
                /* not valid JSON */
            }
        }
    }
    return null;
}

function findItemList(data) {
    if (!data || typeof data !== 'object') return null;
    const loaderData = data.loaderData;
    if (!loaderData || typeof loaderData !== 'object') return null;

    for (const key of Object.keys(loaderData)) {
        const section = loaderData[key];
        if (!section || typeof section !== 'object') continue;
        const itemList = section.videoInfoRes?.item_list;
        if (Array.isArray(itemList) && itemList.length > 0) return itemList;
        const detail = section.videoDetailRes?.item_list;
        if (Array.isArray(detail) && detail.length > 0) return detail;
    }
    return null;
}

function firstUrl(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    const list = obj.url_list || obj.urlList || [];
    for (const u of list) {
        if (typeof u === 'string' && u.trim()) {
            // douyin serves http(s)://...; normalise to https
            return u.replace(/^http:\/\//, 'https://');
        }
    }
    return null;
}

export function itemToMetadata(item, fallbackUrl) {
    const author = item.author || {};
    const video = item.video || {};
    const durationMs = Number(item.duration || video.duration || 0);
    const title = (item.desc || '').trim();
    const authorName = author.nickname || author.unique_id || 'Unknown';

    return {
        videoId: String(item.aweme_id || ''),
        title: title || `${authorName} 的视频`,
        description: title,
        author: authorName,
        authorAvatar: firstUrl(author.avatar_thumb) || firstUrl(author.avatar_medium),
        uniqueId: author.unique_id || null,
        duration: Math.round(durationMs / 1000),
        coverUrl: firstUrl(video.cover) || firstUrl(video.origin_cover) || firstUrl(item.cover),
        publishedAt: item.create_time ? new Date(item.create_time * 1000).toISOString() : null,
        downloadUrl: firstUrl(video.play_addr) || firstUrl(video.download_addr),
        sourceUrl: fallbackUrl,
    };
}

function metadataFromOg(html, fallbackUrl) {
    const grab = (prop) => {
        const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
        if (m) return decodeEntities(m[1]);
        const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
        return m2 ? decodeEntities(m2[1]) : null;
    };
    return {
        videoId: null,
        title: grab('og:title') || grab('og:video:title') || '',
        description: grab('og:description') || '',
        author: '',
        authorAvatar: null,
        uniqueId: null,
        duration: 0,
        coverUrl: grab('og:image'),
        publishedAt: grab('article:published_time') || grab('og:video:release_date') || null,
        downloadUrl: grab('og:video') || grab('og:video:url'),
        sourceUrl: fallbackUrl,
    };
}

function decodeEntities(str) {
    return String(str)
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/</g, '<')
        .replace(/>/g, '>');
}

async function fetchSharePage(url) {
    // Referer is already part of the client's default headers; keep an explicit
    // override for clarity.
    const resp = await httpClient.get(url, {
        headers: { Referer: 'https://www.douyin.com/' },
        timeout: httpClient.config.timeoutMs,
    });
    return resp.data;
}

/* ------------------------------------------------------------------ */
/* Fallback extraction                                                 */
/* ------------------------------------------------------------------ */

// The desktop /video/{id} page frequently answers with a JS anti-bot shell
// (obfuscated `window._$jsvmprt` VM code) that contains neither _ROUTER_DATA
// nor Open Graph tags, so no playable address can be extracted from it. The two
// helpers below recover a working play URL without executing that JS.
const MOBILE_USER_AGENT =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

/**
 * Douyin's official web detail API returns the full item as JSON — including a
 * high-quality, watermark-free `play_addr` — with no JS challenge and (in
 * practice) without requiring an `a_bogus`/`msToken` signature.
 * Returns the raw `aweme_detail` object, or null when unavailable.
 *
 * `client` is injectable for offline tests; it defaults to the shared client.
 */
export async function fetchDetailViaApi(videoId, client = httpClient) {
    const url = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${encodeURIComponent(videoId)}`;
    const resp = await client.get(url, {
        headers: { Referer: `https://www.douyin.com/video/${videoId}` },
        timeout: client.config.timeoutMs,
    });
    const detail = resp.data && resp.data.aweme_detail;
    if (!detail || String(detail.aweme_id || '') === '') return null;
    return detail;
}

/**
 * The mobile share page (https://www.iesdouyin.com/share/video/{id}) still
 * embeds a `_ROUTER_DATA` blob with a playable address even when the desktop
 * page is blocked. It is fetched with a mobile User-Agent to avoid being
 * redirected back to the desktop anti-bot shell.
 * Returns the first video item, or null.
 *
 * `client` is injectable for offline tests; it defaults to the shared client.
 */
export async function fetchMobileShareItem(videoId, client = httpClient) {
    const url = `https://www.iesdouyin.com/share/video/${encodeURIComponent(videoId)}`;
    const resp = await client.get(url, {
        headers: { Referer: 'https://www.douyin.com/', 'User-Agent': MOBILE_USER_AGENT },
        timeout: client.config.timeoutMs,
    });
    const html = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    const routerData = extractRouterData(html);
    const itemList = findItemList(routerData);
    return itemList && itemList.length > 0 ? itemList[0] : null;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch metadata for a Douyin URL (short or full). Returns:
 * { videoId, title, description, author, authorAvatar, uniqueId,
 *   duration, coverUrl, publishedAt, downloadUrl, sourceUrl }
 */
export async function fetchVideoMetadata(rawUrl) {
    if (MOCK_MODE) {
        return mockMetadata(rawUrl);
    }

    // Note: Douyin sometimes answers with a JS anti-bot shell page (no
    // _ROUTER_DATA / og tags). In that case the page yields no item at all, so
    // the video id must come from the URL itself — which is why both the
    // resolved (canonical) URL AND the original raw URL are consulted below.
    const resolvedUrl = await resolveShortUrl(rawUrl);
    const html = await fetchSharePage(resolvedUrl);
    const routerData = extractRouterData(html);
    const itemList = findItemList(routerData);

    let metadata = null;
    if (itemList && itemList.length > 0) {
        metadata = itemToMetadata(itemList[0], resolvedUrl);
    }

    if (!metadata || !metadata.videoId || !metadata.downloadUrl) {
        const og = metadataFromOg(html, resolvedUrl);
        if (!metadata) metadata = og;
        else Object.assign(metadata, og);
    }

    // Fall back to the ORIGINAL URL too: a modal_id URL (jingxuan/discover)
    // carries the video id in the query string even if the resolved page ever
    // drops it. This guarantees the "Could not extract the video id" error can
    // no longer occur for supported formats (https://www.douyin.com/video/{id},
    // /note/{id}, /share/video/{id}, ?modal_id={id}).
    const videoIdFromUrl =
        extractVideoId(resolvedUrl)?.id ??
        extractVideoId(rawUrl)?.id;
    if (!metadata.videoId && videoIdFromUrl) metadata.videoId = videoIdFromUrl;

    if (!metadata.videoId) {
        throw new Error('Could not extract the video id from this Douyin page');
    }

    // The desktop page was very likely an anti-bot shell with no playable
    // address (that is the whole reason we are here). Recover a working
    // downloadUrl — and fill any still-missing metadata — from the web detail
    // API first, then the mobile share page.
    if (!metadata.downloadUrl) {
        try {
            const apiItem = await fetchDetailViaApi(metadata.videoId);
            if (apiItem) {
                const apiMeta = itemToMetadata(apiItem, resolvedUrl);
                metadata = { ...metadata, ...apiMeta, videoId: apiMeta.videoId || metadata.videoId };
            }
        } catch (err) {
            if (err instanceof DouyinError) throw err; // typed auth/rate-limit errors bubble up
            console.warn(`[DouyinClient] detail API fallback failed for ${metadata.videoId}: ${err.message}`);
        }
    }
    if (!metadata.downloadUrl) {
        try {
            const mobileItem = await fetchMobileShareItem(metadata.videoId);
            if (mobileItem) {
                const mobileMeta = itemToMetadata(mobileItem, resolvedUrl);
                metadata = { ...metadata, ...mobileMeta, videoId: mobileMeta.videoId || metadata.videoId };
            }
        } catch (err) {
            if (err instanceof DouyinError) throw err; // typed auth/rate-limit errors bubble up
            console.warn(`[DouyinClient] mobile share fallback failed for ${metadata.videoId}: ${err.message}`);
        }
    }

    if (!metadata.title) metadata.title = `${metadata.author || 'Unknown'} 的视频`;
    if (!metadata.author) metadata.author = 'Unknown';

    return metadata;
}

function findCreatorPostItems(data) {
    if (!data || typeof data !== 'object') return null;
    const loaderData = data.loaderData;
    if (!loaderData || typeof loaderData !== 'object') return null;

    for (const key of Object.keys(loaderData)) {
        const section = loaderData[key];
        if (!section || typeof section !== 'object') continue;
        const userList = section.user_list;
        if (userList && typeof userList === 'object') {
            const post = userList.post;
            if (Array.isArray(post) && post.length > 0) return post;
            const video = userList.video;
            if (Array.isArray(video) && video.length > 0) return video;
        }
    }
    return null;
}

/**
 * Fetch a creator's most recent videos from their Douyin user page
 * (https://www.douyin.com/user/{sec_uid} or a short share link).
 * Returns an array of metadata objects (reuses itemToMetadata).
 */
export async function fetchCreatorRecentVideos(userUrl) {
    if (MOCK_MODE) {
        return mockCreatorVideos(userUrl);
    }

    const resolvedUrl = await resolveShortUrl(userUrl);
    const html = await fetchSharePage(resolvedUrl);
    const routerData = extractRouterData(html);
    const items = findCreatorPostItems(routerData);

    if (!items || items.length === 0) {
        throw new Error('No videos could be extracted from this creator page');
    }

    return items
        .map((item) => {
            const meta = itemToMetadata(item, resolvedUrl);
            return meta;
        })
        .filter((m) => m.videoId);
}

function mockCreatorVideos(userUrl) {
    const seed = String(userUrl).split('/').filter(Boolean).pop() || 'creator';
    const hash = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 1e9, 7);
    const author = `Creator_${hash % 1000}`;
    const out = [];
    for (let i = 0; i < 3; i++) {
        const videoId = String(7100000000000000000 + hash + i);
        out.push({
            videoId,
            title: `[Mock] ${author} 的最新视频 #${i + 1}`,
            description: `Mock creator video ${i + 1}`,
            author,
            authorAvatar: null,
            uniqueId: `mock_${hash % 1000}`,
            duration: 12 + i,
            coverUrl: null,
            publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
            downloadUrl: `file://${DUMMY_VIDEO_PATH}`,
            sourceUrl: userUrl,
        });
    }
    return out;
}

function mockMetadata(rawUrl) {
    // If the URL already contains a canonical /video/{id}, keep that id so the
    // worker reuses the same video row (consistent with creator monitoring).
    const urlId = extractVideoId(rawUrl)?.id;
    const seed = urlId || String(rawUrl).split('/').filter(Boolean).pop() || 'mock';
    const hash = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 1e9, 7);
    const videoId = urlId || String(7000000000000000000 + hash);
    const authors = ['美食小分队', '摄影日记', '科技前沿', '旅行在路上', '生活小妙招'];
    const author = authors[hash % authors.length];
    return {
        videoId,
        title: `[Mock] 示例视频 ${seed} — ${author} 的作品`,
        description: 'This is a mock video used for offline development/testing (DOUYIN_MOCK=1).',
        author,
        authorAvatar: null,
        uniqueId: `mock_${hash % 1000}`,
        duration: 15,
        coverUrl: null,
        publishedAt: new Date(Date.now() - (hash % 30) * 86400000).toISOString(),
        downloadUrl: `file://${DUMMY_VIDEO_PATH}`,
        sourceUrl: rawUrl,
    };
}

/**
 * Download a video to `destPath`.
 * `onProgress(percent)` is invoked while bytes stream in.
 * Returns { filePath, fileSize, mimeType }.
 */
export async function downloadVideo(downloadUrl, destPath, { onProgress } = {}) {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    if (MOCK_MODE || String(downloadUrl).startsWith('file://')) {
        await copyDummyVideo(destPath, onProgress);
        const stat = fs.statSync(destPath);
        return { filePath: destPath, fileSize: stat.size, mimeType: 'video/mp4' };
    }

    const resp = await httpClient.get(downloadUrl, {
        responseType: 'stream',
        timeout: httpClient.config.downloadTimeoutMs,
        headers: {
            Referer: 'https://www.douyin.com/',
            Accept: '*/*',
        },
    });

    const total = parseInt(resp.headers['content-length'] || '0', 10);
    const writer = fs.createWriteStream(destPath);
    let received = 0;

    await new Promise((resolve, reject) => {
        resp.data.on('data', (chunk) => {
            received += chunk.length;
            if (total > 0 && onProgress) {
                onProgress(Math.min(100, Math.round((received / total) * 100)));
            }
        });
        writer.on('finish', resolve);
        writer.on('error', reject);
        resp.data.on('error', reject);
        resp.data.pipe(writer);
    });

    return {
        filePath: destPath,
        fileSize: received,
        mimeType: resp.headers['content-type'] || 'video/mp4',
    };
}

async function copyDummyVideo(destPath, onProgress) {
    if (!fs.existsSync(DUMMY_VIDEO_PATH)) {
        fs.writeFileSync(destPath, Buffer.from(''));
        onProgress && onProgress(100);
        return;
    }
    const stat = fs.statSync(DUMMY_VIDEO_PATH);
    const src = fs.createReadStream(DUMMY_VIDEO_PATH);
    const dest = fs.createWriteStream(destPath);
    let copied = 0;
    src.on('data', (chunk) => {
        copied += chunk.length;
        if (stat.size > 0 && onProgress) {
            onProgress(Math.min(100, Math.round((copied / stat.size) * 100)));
        }
    });
    await new Promise((resolve, reject) => {
        dest.on('finish', resolve);
        dest.on('error', reject);
        src.on('error', reject);
        src.pipe(dest);
    });
}

export default {
    extractVideoId,
    resolveShortUrl,
    fetchVideoMetadata,
    downloadVideo,
};
