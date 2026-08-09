/**
 * douyin-auth-integration.mjs — integration test for the authenticated Douyin
 * HTTP client + config/cookie validation, wired through the real feature boot.
 *
 * Covers:
 *   1. initDouyinFeature boots with DOUYIN_COOKIES configured (mock mode).
 *   2. DouyinHttpClient against a real local HTTP server: cookie header sent,
 *      default headers sent, 429 -> DouyinRateLimitException, 401 ->
 *      DouyinAuthenticationException.
 *   3. Cookie validation fails fast with DOUYIN_REQUIRE_COOKIE=1 and no cookie.
 *
 * Usage: node tests/douyin-auth-integration.mjs
 */

process.env.DOUYIN_MOCK = '1';
process.env.DOUYIN_COOKIES = 'sessionid=itest;ttwid=itest_ttwid;msToken=itest_ms';

import http from 'http';
import express from 'express';
import Database from 'better-sqlite3';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { initDouyinFeature } from '../douyin-integration.js';
import { DouyinHttpClient } from '../douyin-http-client.js';
import { loadDouyinConfig } from '../config/douyin.config.js';
import { validateCookies } from '../douyin-cookies.js';
import {
    DouyinAuthenticationException,
    DouyinRateLimitException,
    DouyinCookieMissingException,
} from '../douyin-errors.js';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/* ------------------------------------------------------------------ */
/* 1. Full feature boots with cookies configured (mock mode)           */
/* ------------------------------------------------------------------ */

try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-auth-int-'));
    const dbPath = path.join(tmpDir, 'test.db');
    const db = new Database(dbPath);
    const app = express();
    app.use(express.json());
    const feature = initDouyinFeature({ app, db });

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/douyin`;

    const res = await fetch(`${base}/stats`);
    const stats = await res.json();
    check('initDouyinFeature boots with DOUYIN_COOKIES (mock)', res.ok && typeof stats.totalVideos === 'number');

    feature.stop();
    server.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (err) {
    check(`initDouyinFeature boots with DOUYIN_COOKIES (mock) — error: ${err.message}`, false);
}

/* ------------------------------------------------------------------ */
/* 2. Cookie validation                                                */
/* ------------------------------------------------------------------ */

try {
    const ok = validateCookies(process.env.DOUYIN_COOKIES);
    check(
        'validateCookies accepts configured cookie',
        ok.pairs.length >= 2 && ok.missingRecommended.length === 0
    );
} catch (err) {
    check(`validateCookies accepts configured cookie — error: ${err.message}`, false);
}

try {
    validateCookies('ttwid=missing-session');
    check('validateCookies rejects missing sessionid', false);
} catch (err) {
    check(
        'validateCookies rejects missing sessionid',
        err instanceof DouyinCookieMissingException && err.code === 'DOUYIN_COOKIE_MISSING'
    );
}

/* ------------------------------------------------------------------ */
/* 3. Real local HTTP server exercising the client end-to-end          */
/* ------------------------------------------------------------------ */

let captured = null;
let responseMode = 200;

const target = http.createServer((req, res) => {
    captured = { url: req.url, headers: req.headers };
    if (responseMode === 429) {
        res.writeHead(429, { 'content-type': 'text/plain', 'retry-after': '1' });
        res.end('rate limited');
        return;
    }
    if (responseMode === 401) {
        res.writeHead(401, { 'content-type': 'text/plain' });
        res.end('unauthorized');
        return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>ok</html>');
});

await new Promise((resolve) => target.listen(0, resolve));
const targetPort = target.address().port;

try {
    const config = loadDouyinConfig({
        DOUYIN_COOKIES: 'sessionid=itest;ttwid=itest_ttwid',
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        DOUYIN_TIMEOUT_MS: '3000',
        DOUYIN_MAX_RETRIES: '2',
        DOUYIN_RETRY_DELAY_MS: '1',
    });
    const client = new DouyinHttpClient({ config, logger: { info: () => {}, warn: () => {}, error: () => {} } });

    // 3a. cookie + default headers delivered to a real server
    const resp = await client.get(`http://127.0.0.1:${targetPort}/video/123`);
    check('real server receives HTTP 200', resp.status === 200);
    check('real server receives Cookie header', captured.headers.cookie === 'sessionid=itest; ttwid=itest_ttwid', captured.headers.cookie);
    check('real server receives Referer', captured.headers.referer === 'https://www.douyin.com/');
    check('real server receives Accept-Language', captured.headers['accept-language'] === 'zh-CN,zh;q=0.9');
    check('real server receives modern User-Agent', /Chrome\/\d+/.test(captured.headers['user-agent'] || ''));

    // 3b. 429 maps to DouyinRateLimitException (after retries)
    responseMode = 429;
    try {
        await client.get(`http://127.0.0.1:${targetPort}/video/429`);
        check('429 maps to DouyinRateLimitException', false);
    } catch (err) {
        check(
            '429 maps to DouyinRateLimitException',
            err instanceof DouyinRateLimitException && err.status === 429 && err.retryAfter === 1000,
            err.message
        );
    }

    // 3c. 401 maps to DouyinAuthenticationException (no retry)
    responseMode = 401;
    try {
        await client.get(`http://127.0.0.1:${targetPort}/video/401`);
        check('401 maps to DouyinAuthenticationException', false);
    } catch (err) {
        check(
            '401 maps to DouyinAuthenticationException',
            err instanceof DouyinAuthenticationException && err.status === 401,
            err.message
        );
    }
} catch (err) {
    check(`local server integration — error: ${err.message}`, false);
} finally {
    target.close();
}

/* ------------------------------------------------------------------ */
/* 4. Fail fast when cookie is required but missing                    */
/* ------------------------------------------------------------------ */

try {
    const cfg = loadDouyinConfig({
        DOUYIN_COOKIES: '',
        DOUYIN_REQUIRE_COOKIE: '1',
        DOUYIN_MOCK: '0',
    });
    new DouyinHttpClient({ config: cfg, logger: { info: () => {}, warn: () => {}, error: () => {} } });
    check('requireCookie + missing cookie throws at construction', false);
} catch (err) {
    check(
        'requireCookie + missing cookie throws at construction',
        err instanceof DouyinCookieMissingException && err.code === 'DOUYIN_COOKIE_MISSING'
    );
}

/* ------------------------------------------------------------------ */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
