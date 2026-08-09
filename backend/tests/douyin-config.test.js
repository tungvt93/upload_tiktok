/**
 * douyin-config.test.js — unit tests for the config module, cookie validation
 * and the custom exceptions. Uses Node's built-in test runner (node:test).
 *
 * Usage: node --test tests/douyin-config.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import fs from 'fs';
import path from 'path';

import { loadDouyinConfig, loadDotenv } from '../config/douyin.config.js';
import {
    parseCookieString,
    normalizeCookieHeader,
    countCookiePairs,
    validateCookies,
    REQUIRED_COOKIES,
} from '../douyin-cookies.js';
import {
    DouyinError,
    DouyinCookieMissingException,
    DouyinAuthenticationException,
    DouyinRateLimitException,
} from '../douyin-errors.js';

/* ------------------------------------------------------------------ */
/* Cookie parsing                                                      */
/* ------------------------------------------------------------------ */

test('parseCookieString: empty input returns []', () => {
    assert.deepEqual(parseCookieString(undefined), []);
    assert.deepEqual(parseCookieString(''), []);
    assert.deepEqual(parseCookieString('   '), []);
    assert.deepEqual(parseCookieString(null), []);
});

test('parseCookieString: header-string format', () => {
    assert.deepEqual(parseCookieString('a=1; b=2'), [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
    ]);
});

test('parseCookieString: header-string tolerates whitespace and skips tokenless parts', () => {
    assert.deepEqual(parseCookieString('  a=1 ;b  '), [{ name: 'a', value: '1' }]);
});

test('parseCookieString: JSON array format', () => {
    const raw = JSON.stringify([
        { name: 'sessionid', value: 's1' },
        { name: 'ttwid', value: 't1' },
    ]);
    assert.deepEqual(parseCookieString(raw), [
        { name: 'sessionid', value: 's1' },
        { name: 'ttwid', value: 't1' },
    ]);
});

test('parseCookieString: malformed input returns []', () => {
    assert.deepEqual(parseCookieString('not-a-cookie'), []);
    assert.deepEqual(parseCookieString('a=1;b'), [{ name: 'a', value: '1' }]);
});

test('normalizeCookieHeader: joins pairs with "; "', () => {
    assert.equal(normalizeCookieHeader('a=1; b=2'), 'a=1; b=2');
    assert.equal(normalizeCookieHeader(''), '');
    assert.equal(
        normalizeCookieHeader(JSON.stringify([{ name: 'x', value: 'y' }])),
        'x=y'
    );
});

test('countCookiePairs counts parseable pairs', () => {
    assert.equal(countCookiePairs('a=1; b=2; c=3'), 3);
    assert.equal(countCookiePairs('garbage'), 0);
});

/* ------------------------------------------------------------------ */
/* Cookie validation                                                   */
/* ------------------------------------------------------------------ */

test('validateCookies: empty cookie throws DouyinCookieMissingException', () => {
    assert.throws(() => validateCookies(''), DouyinCookieMissingException);
    assert.throws(() => validateCookies(undefined), DouyinCookieMissingException);
    assert.throws(() => validateCookies('   '), DouyinCookieMissingException);
});

test('validateCookies: malformed cookie string throws', () => {
    assert.throws(() => validateCookies('this-is-not-a-cookie'), DouyinCookieMissingException);
    assert.throws(
        () => validateCookies('[not valid json'),
        DouyinCookieMissingException
    );
});

test('validateCookies: missing sessionid throws', () => {
    assert.throws(
        () => validateCookies('ttwid=abc; msToken=xyz'),
        (err) =>
            err instanceof DouyinCookieMissingException &&
            err.message.includes('sessionid') &&
            err.code === 'DOUYIN_COOKIE_MISSING' &&
            err.status === 401
    );
});

test('validateCookies: valid cookie passes and reports missing recommended', () => {
    const result = validateCookies('sessionid=s1; ttwid=t1');
    assert.equal(result.pairs.length, 2);
    assert.deepEqual(result.missingRecommended, ['msToken']);
});

test('validateCookies: returns all pairs when nothing is missing', () => {
    const result = validateCookies('sessionid=s1; ttwid=t1; msToken=m1');
    assert.deepEqual(result.missingRecommended, []);
});

test('REQUIRED_COOKIES contains sessionid', () => {
    assert.ok(REQUIRED_COOKIES.includes('sessionid'));
});

/* ------------------------------------------------------------------ */
/* Custom exceptions                                                   */
/* ------------------------------------------------------------------ */

test('DouyinCookieMissingException shape', () => {
    const err = new DouyinCookieMissingException('nope');
    assert.ok(err instanceof DouyinError);
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'DouyinCookieMissingException');
    assert.equal(err.code, 'DOUYIN_COOKIE_MISSING');
    assert.equal(err.status, 401);
});

test('DouyinAuthenticationException shape', () => {
    const err = new DouyinAuthenticationException('rejected');
    assert.ok(err instanceof DouyinError);
    assert.equal(err.name, 'DouyinAuthenticationException');
    assert.equal(err.code, 'DOUYIN_AUTH_FAILED');
    assert.equal(err.status, 401);
});

test('DouyinRateLimitException shape', () => {
    const err = new DouyinRateLimitException('slow down', 30);
    assert.ok(err instanceof DouyinError);
    assert.equal(err.name, 'DouyinRateLimitException');
    assert.equal(err.code, 'DOUYIN_RATE_LIMITED');
    assert.equal(err.status, 429);
    assert.equal(err.retryAfter, 30);
});

/* ------------------------------------------------------------------ */
/* Config module                                                       */
/* ------------------------------------------------------------------ */

test('loadDouyinConfig: defaults', () => {
    const cfg = loadDouyinConfig({});
    assert.equal(cfg.cookies, '');
    assert.equal(cfg.httpProxy, '');
    assert.equal(cfg.httpsProxy, '');
    assert.equal(cfg.requireCookie, false);
    assert.equal(cfg.mock, false);
    assert.equal(cfg.maxRetries, 3);
    assert.equal(cfg.timeoutMs, 20000);
    assert.equal(cfg.downloadTimeoutMs, 600000);
    assert.equal(cfg.retryDelayMs, 1000);
    assert.equal(cfg.rateLimitMs, 0);
    assert.ok(cfg.userAgent.includes('Chrome'));
});

test('loadDouyinConfig: overrides from env', () => {
    const cfg = loadDouyinConfig({
        DOUYIN_COOKIES: 'sessionid=s1',
        HTTP_PROXY: 'http://127.0.0.1:8080',
        HTTPS_PROXY: 'http://127.0.0.1:8080',
        DOUYIN_REQUIRE_COOKIE: '1',
        DOUYIN_MAX_RETRIES: '5',
        DOUYIN_TIMEOUT_MS: '7000',
        DOUYIN_RATE_LIMIT_MS: '250',
        DOUYIN_MOCK: '1',
    });
    assert.equal(cfg.cookies, 'sessionid=s1');
    assert.equal(cfg.httpProxy, 'http://127.0.0.1:8080');
    assert.equal(cfg.requireCookie, true);
    assert.equal(cfg.mock, true);
    assert.equal(cfg.maxRetries, 5);
    assert.equal(cfg.timeoutMs, 7000);
    assert.equal(cfg.rateLimitMs, 250);
});

test('loadDouyinConfig: tolerant of lowercase proxy env names', () => {
    const cfg = loadDouyinConfig({ http_proxy: 'http://p:1', https_proxy: 'http://p:1' });
    assert.equal(cfg.httpProxy, 'http://p:1');
    assert.equal(cfg.httpsProxy, 'http://p:1');
});

test('loadDouyinConfig: invalid integers fall back to defaults', () => {
    const cfg = loadDouyinConfig({ DOUYIN_MAX_RETRIES: 'abc', DOUYIN_TIMEOUT_MS: '-5' });
    assert.equal(cfg.maxRetries, 3);
    assert.equal(cfg.timeoutMs, 20000);
});

test('loadDotenv: loads a .env file without overriding existing env', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-dotenv-'));
    try {
        fs.writeFileSync(
            path.join(tmpDir, '.env'),
            '# comment\nDOUYIN_TEST_KEY=hello\nDOUYIN_TEST_QUOTED="world"\n'
        );
        // Pre-set an existing var to verify non-override behaviour.
        process.env.DOUYIN_TEST_QUOTED = 'kept';
        const loaded = loadDotenv(tmpDir);
        assert.equal(loaded, path.join(tmpDir, '.env'));
        assert.equal(process.env.DOUYIN_TEST_KEY, 'hello');
        assert.equal(process.env.DOUYIN_TEST_QUOTED, 'kept');
    } finally {
        delete process.env.DOUYIN_TEST_KEY;
        delete process.env.DOUYIN_TEST_QUOTED;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
