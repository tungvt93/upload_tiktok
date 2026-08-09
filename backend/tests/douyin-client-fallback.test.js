/**
 * douyin-client-fallback.test.js — offline unit tests for the downloadUrl
 * fallback extraction added to fix "No playable video address could be
 * extracted".
 *
 * Douyin's desktop /video/{id} page frequently answers with a JS anti-bot shell
 * (no _ROUTER_DATA, no og tags), so no playable address can be extracted from
 * it. The fix recovers the play URL from:
 *   1. the web detail API  (https://www.douyin.com/aweme/v1/web/aweme/detail/)
 *   2. the mobile share page (https://www.iesdouyin.com/share/video/{id})
 *
 * All requests below go through an injected fake axios adapter — no network.
 *
 * Usage: node --test tests/douyin-client-fallback.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DouyinHttpClient } from '../douyin-http-client.js';
import { fetchDetailViaApi, fetchMobileShareItem, itemToMetadata } from '../douyin-client.js';

const VIDEO_ID = '7666774315384372859';
const SILENT = { info: () => {}, warn: () => {}, error: () => {} };

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

// Shape observed from the real web detail API response.
const API_DETAIL = {
    aweme_detail: {
        aweme_id: VIDEO_ID,
        desc: '随机奖励一位幸运之子',
        create_time: 1780000000,
        author: { nickname: '魏来', unique_id: 'weilai', avatar_thumb: { url_list: ['https://p3.douyinpic.com/a.jpeg'] } },
        video: {
            duration: 2202000,
            cover: { url_list: ['https://p3.douyinpic.com/cover.jpeg'] },
            play_addr: {
                url_list: [
                    'https://v3-dy-o.zjcdn.com/abc/play.mp4?a=0&mime_type=video_mp4',
                    'https://api.amemv.com/aweme/v1/play/?video_id=xxxx',
                ],
            },
            download_addr: { url_list: ['https://v3-dy-o.zjcdn.com/abc/download.mp4'] },
        },
    },
    status_code: 0,
};

// Shape observed from the mobile share page's embedded _ROUTER_DATA.
const MOBILE_SHARE_HTML = `<html><head></head><body><script>window._ROUTER_DATA = ${JSON.stringify({
    loaderData: {
        'video_(id)/page': {
            videoInfoRes: {
                item_list: [
                    {
                        aweme_id: VIDEO_ID,
                        desc: 'mobile share desc',
                        author: { nickname: 'MobileAuthor', unique_id: 'm1' },
                        video: {
                            duration: 15000,
                            play_addr: {
                                url_list: ['https://aweme.snssdk.com/aweme/v1/playwm/?video_id=abc123&ratio=720p&line=0'],
                            },
                        },
                    },
                ],
            },
        },
    },
})}</script></body></html>`;

// Anti-bot shell: desktop page that yields nothing (the pre-fix failure mode).
const ANTI_BOT_HTML = `<html><head><meta charset="UTF-8" /></head><body></body><script>var glb;glb._$jsvmprt=function(){};</script></html>`;

function makeResponse(config, { status = 200, data = '' } = {}) {
    return {
        data,
        status,
        statusText: String(status),
        headers: { 'content-type': 'text/html' },
        config,
        request: {},
    };
}

/** Build a DouyinHttpClient whose adapter routes by URL. */
function buildClient(route) {
    const config = {
        cookies: '',
        requireCookie: false,
        mock: false,
        httpProxy: '',
        httpsProxy: '',
        userAgent: 'Test-UA',
        timeoutMs: 1000,
        downloadTimeoutMs: 1000,
        maxRetries: 0,
        retryDelayMs: 1,
        rateLimitMs: 0,
    };
    const adapter = async (cfg) => route(String(cfg.url || ''));
    return new DouyinHttpClient({ config, adapter, logger: SILENT });
}

/* ------------------------------------------------------------------ */
/* Web detail API fallback                                             */
/* ------------------------------------------------------------------ */

test('fetchDetailViaApi: recovers aweme_detail with a playable downloadUrl', async () => {
    const client = buildClient((url) => {
        assert.match(url, /\/aweme\/v1\/web\/aweme\/detail\//);
        return makeResponse({ url }, { data: API_DETAIL });
    });

    const detail = await fetchDetailViaApi(VIDEO_ID, client);
    assert.ok(detail, 'expected an aweme_detail object');
    assert.equal(detail.aweme_id, VIDEO_ID);

    const meta = itemToMetadata(detail, `https://www.douyin.com/video/${VIDEO_ID}`);
    assert.equal(meta.videoId, VIDEO_ID);
    assert.match(meta.downloadUrl, /^https:\/\//);
    assert.match(meta.downloadUrl, /zjcdn\.com/);
    assert.ok(meta.title);
    assert.ok(meta.author);
    assert.ok(meta.duration > 0);
});

test('fetchDetailViaApi: returns null when the API has no aweme_detail', async () => {
    const client = buildClient(() => makeResponse({ url: '' }, { data: { status_code: 11110, status_msg: 'encrypt_data_miss' } }));
    const detail = await fetchDetailViaApi(VIDEO_ID, client);
    assert.equal(detail, null);
});

/* ------------------------------------------------------------------ */
/* Mobile share page fallback                                          */
/* ------------------------------------------------------------------ */

test('fetchMobileShareItem: parses _ROUTER_DATA and yields a playable address', async () => {
    const client = buildClient((url) => {
        assert.match(url, /\/share\/video\//);
        return makeResponse({ url }, { data: MOBILE_SHARE_HTML });
    });

    const item = await fetchMobileShareItem(VIDEO_ID, client);
    assert.ok(item, 'expected a video item from the mobile share page');
    assert.equal(item.aweme_id, VIDEO_ID);

    const meta = itemToMetadata(item, `https://www.iesdouyin.com/share/video/${VIDEO_ID}`);
    assert.match(meta.downloadUrl, /playwm|snssdk\.com/);
});

test('fetchMobileShareItem: returns null for an anti-bot shell with no data', async () => {
    const client = buildClient(() => makeResponse({ url: '' }, { data: ANTI_BOT_HTML }));
    const item = await fetchMobileShareItem(VIDEO_ID, client);
    assert.equal(item, null);
});
