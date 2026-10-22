// Resolve the direct CDN video URL for a Douyin video using a real browser session.
//
// Why this exists: since ~2026-10-09 Douyin answers unsigned requests to its web
// detail API with HTTP 403 "Blocked by ArgusSecurityPlugin Uifid Not Found". That
// is exactly what yt-dlp's Douyin extractor sends — only `aweme_id`, no a_bogus /
// msToken signature (upstream even leaves a "TODO: Run verification challenge code
// to generate signature cookies" next to the error it raises). Refreshing
// cookies.txt does not help: a UIFID cookie only becomes valid once a real
// browsing session has registered it, and the plugin rejects the request no matter
// which IP/proxy it comes from.
//
// So we drive the page in Playwright — visit the homepage first so the page's
// secsdk registers a UIFID, then open the video page and read the detail JSON off
// the wire. Same spirit as resolveKuaishouVideoUrl in server.js, one layer deeper.
//
// Douyin's anti-bot still wins occasionally: a small fraction of videos answer 403
// (or never fire the XHR) on one attempt and resolve fine on another, so a failure
// here is worth retrying later rather than treating the video as gone.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildBrowserLaunchOptions } from './browser-launch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A dedicated persistent profile: keeping the registered UIFID/ttwid across server
// restarts is what lets later resolutions skip the slow homepage warm-up.
const DOUYIN_PROFILE_DIR = path.join(__dirname, 'profiles', '_douyin_resolver');
const HOME_URL = 'https://www.douyin.com/';
const WARMUP_MS = 9000;          // time the homepage needs for secsdk to issue UIFID
const DETAIL_TIMEOUT_MS = 30000; // how long to wait for the detail XHR per video
const IDLE_SHUTDOWN_MS = 180000; // close the browser after 3 min of no downloads

let ctxPromise = null;   // in-flight / resolved browser context
let warmedUp = false;    // homepage visited in this context
let idleTimer = null;
let queue = Promise.resolve(); // resolutions run one at a time

export function isDouyinVideoUrl(url) {
    try {
        const u = new URL(url);
        if (!/(^|\.)douyin\.com$/.test(u.hostname)) return false;
        return /\/video\/\d+/.test(u.pathname);
    } catch (e) {
        return false;
    }
}

// Douyin /note/<id> links are photo posts, not videos — callers reject them early.
export function isDouyinNoteUrl(url) {
    try {
        const u = new URL(url);
        return /(^|\.)douyin\.com$/.test(u.hostname) && /\/note\/\d+/.test(u.pathname);
    } catch (e) {
        return false;
    }
}

export function extractDouyinVideoId(url) {
    const m = String(url).match(/\/video\/(\d+)/);
    return m ? m[1] : null;
}

async function getContext() {
    if (!ctxPromise) {
        ctxPromise = (async () => {
            fs.mkdirSync(DOUYIN_PROFILE_DIR, { recursive: true });
            const options = buildBrowserLaunchOptions(null, { viewport: { width: 1366, height: 768 } });
            const ctx = await chromium.launchPersistentContext(DOUYIN_PROFILE_DIR, options);
            ctx.on('close', () => { ctxPromise = null; warmedUp = false; });
            return ctx;
        })().catch((err) => { ctxPromise = null; throw err; });
    }
    return ctxPromise;
}

export async function closeDouyinBrowser() {
    clearTimeout(idleTimer);
    idleTimer = null;
    const p = ctxPromise;
    ctxPromise = null;
    warmedUp = false;
    if (!p) return;
    try { (await p).close(); } catch (e) { /* already gone */ }
}

function scheduleIdleShutdown() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { closeDouyinBrowser(); }, IDLE_SHUTDOWN_MS);
    if (idleTimer.unref) idleTimer.unref();
}

// Visiting the homepage is what makes Douyin's security plugin accept later API
// calls from this context. Cheap to repeat, so we also use it to recover from a 403.
async function warmUp(ctx) {
    const page = await ctx.newPage();
    try {
        await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(WARMUP_MS);
        warmedUp = true;
    } finally {
        await page.close().catch(() => {});
    }
}

// Candidate URLs, best first: highest-bitrate H.264 rendition, then the generic
// play_addr, then anything else. url_list entries point at different CDN edges and
// some of them are unreachable from outside China, so callers must try them in turn.
function collectVideoUrls(video) {
    const urls = [];
    const push = (addr) => {
        for (const u of (addr && addr.url_list) || []) {
            if (typeof u === 'string' && u && !urls.includes(u)) urls.push(u);
        }
    };
    const rates = Array.isArray(video.bit_rate) ? [...video.bit_rate] : [];
    const h264 = rates.filter((b) => b && b.is_h265 !== 1 && b.play_addr);
    // Mirrors the "bestvideo[height<=1080]" selector the yt-dlp path used, so the
    // renditions the render/concat steps downstream see do not change: for a portrait
    // clip that cap lands on the ~576x1024 version, same as before.
    h264.sort((a, b) => {
        const ha = a.play_addr.height || 0;
        const hb = b.play_addr.height || 0;
        const aOk = ha <= 1080, bOk = hb <= 1080;
        if (aOk !== bOk) return aOk ? -1 : 1;
        return (b.bit_rate || 0) - (a.bit_rate || 0);
    });
    h264.forEach((b) => push(b.play_addr));
    push(video.play_addr_h264);
    push(video.play_addr);
    rates.filter((b) => b && b.is_h265 === 1 && b.play_addr).forEach((b) => push(b.play_addr));
    return urls;
}

async function resolveOnce(ctx, videoId) {
    const page = await ctx.newPage();
    let detail = null;
    let blocked = false;
    page.on('response', async (res) => {
        const u = res.url();
        if (!u.includes('/aweme/v1/web/aweme/detail/') || !u.includes(videoId)) return;
        if (res.status() !== 200) { blocked = true; return; }
        try {
            const json = await res.json();
            if (json && json.aweme_detail) detail = json.aweme_detail;
        } catch (e) { /* not the payload we want */ }
    });
    try {
        await page.goto(`${HOME_URL}video/${videoId}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        const deadline = Date.now() + DETAIL_TIMEOUT_MS;
        while (!detail && Date.now() < deadline) await page.waitForTimeout(500);
    } finally {
        await page.close().catch(() => {});
    }
    if (!detail) return { blocked };
    if (!detail.video || (detail.images && detail.images.length)) {
        throw new Error('Douyin: post has no video (photo/note post)');
    }
    const urls = collectVideoUrls(detail.video);
    if (!urls.length) throw new Error('Douyin: detail JSON carried no playable URL');
    return {
        urls,
        desc: detail.desc || '',
        durationMs: detail.video.duration || null,
    };
}

// Resolve a Douyin video id to an ordered list of direct CDN URLs. Serialized:
// one page at a time keeps the session below Douyin's anti-bot threshold.
export function resolveDouyinVideoUrls(videoId) {
    const run = async () => {
        clearTimeout(idleTimer);
        try {
            const ctx = await getContext();
            if (!warmedUp) await warmUp(ctx);
            let result = await resolveOnce(ctx, videoId);
            if (!result.urls) {
                // Most often the signature cookies went stale, which a fresh homepage
                // visit fixes. Some videos simply need another go.
                console.log(`[Douyin] detail JSON not captured for ${videoId}${result.blocked ? ' (blocked)' : ''}, warming up and retrying`);
                warmedUp = false;
                await warmUp(ctx);
                result = await resolveOnce(ctx, videoId);
            }
            if (!result.urls) {
                throw new Error(result.blocked
                    ? 'Douyin: detail API blocked by anti-bot (retryable)'
                    : 'Douyin: timed out waiting for the video detail response (retryable)');
            }
            return result;
        } finally {
            scheduleIdleShutdown();
        }
    };
    queue = queue.then(run, run);
    return queue;
}
