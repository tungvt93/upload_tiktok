/**
 * douyin-http-client.test.js — unit tests for the DouyinHttpClient service using
 * an injected fake axios adapter (no network). Covers header injection, retries,
 * timeout/rate limiting wiring, error mapping and logging.
 *
 * Usage: node --test tests/douyin-http-client.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import { DouyinHttpClient, parseProxyUrl, parseRetryAfter, sanitizeMessage } from '../douyin-http-client.js';
import {
    DouyinAuthenticationException,
    DouyinRateLimitException,
    DouyinCookieMissingException,
} from '../douyin-errors.js';

/* ------------------------------------------------------------------ */
/* Test helpers                                                        */
/* ------------------------------------------------------------------ */

function makeResponse(config, { status = 200, data = '', headers = {} } = {}) {
    return {
        data,
        status,
        statusText: String(status),
        headers: { 'content-type': 'text/html', ...headers },
        config,
        request: {},
    };
}

function makeError(config, status, headers = {}) {
    const response = {
        data: '',
        status,
        statusText: String(status),
        headers,
        config,
        request: {},
    };
    return new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
}

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

function captureLogger(store) {
    return {
        info: (...a) => store.info.push(a.join(' ')),
        warn: (...a) => store.warn.push(a.join(' ')),
        error: (...a) => store.error.push(a.join(' ')),
    };
}

function buildClient(options = {}) {
    const config = {
        cookies: options.cookies ?? '',
        requireCookie: options.requireCookie ?? false,
        mock: false,
        httpProxy: options.proxy || '',
        httpsProxy: options.proxy || '',
        userAgent: 'Test-UA',
        timeoutMs: options.timeoutMs ?? 1000,
        downloadTimeoutMs: 1000,
        maxRetries: options.maxRetries ?? 3,
        retryDelayMs: options.retryDelayMs ?? 1,
        rateLimitMs: options.rateLimitMs ?? 0,
    };
    return new DouyinHttpClient({
        config,
        adapter: options.adapter,
        headers: options.headers,
        logger: options.logger || silentLogger,
    });
}

/* ------------------------------------------------------------------ */
/* Header injection                                                    */
/* ------------------------------------------------------------------ */

test('injects browser-like default headers on every request', async () => {
    let seen = null;
    const adapter = async (config) => {
        seen = config;
        return makeResponse(config);
    };
    const client = buildClient({ adapter });
    await client.get('https://www.douyin.com/video/123');

    assert.equal(seen.headers['User-Agent'], 'Test-UA');
    assert.equal(seen.headers.Referer, 'https://www.douyin.com/');
    assert.equal(seen.headers.Accept, 'application/json,text/html,*/*');
    assert.equal(seen.headers['Accept-Language'], 'zh-CN,zh;q=0.9');
});

test('injects Cookie header automatically when configured', async () => {
    let seen = null;
    const adapter = async (config) => {
        seen = config;
        return makeResponse(config);
    };
    const client = buildClient({ adapter, cookies: 'sessionid=s1; ttwid=t1' });
    await client.get('https://www.douyin.com/video/123');
    assert.equal(seen.headers.Cookie, 'sessionid=s1; ttwid=t1');
});

test('omits Cookie header when not configured', async () => {
    let seen = null;
    const adapter = async (config) => {
        seen = config;
        return makeResponse(config);
    };
    const client = buildClient({ adapter });
    await client.get('https://www.douyin.com/video/123');
    assert.equal(seen.headers.Cookie, undefined);
});

test('per-request headers are merged on top of defaults', async () => {
    let seen = null;
    const adapter = async (config) => {
        seen = config;
        return makeResponse(config);
    };
    const client = buildClient({ adapter, cookies: 'sessionid=s1' });
    await client.get('https://www.douyin.com/video/123', { headers: { 'X-Custom': 'yes' } });
    assert.equal(seen.headers['X-Custom'], 'yes');
    assert.equal(seen.headers.Cookie, 'sessionid=s1');
});

/* ------------------------------------------------------------------ */
/* Retries                                                             */
/* ------------------------------------------------------------------ */

test('retries a 500 then succeeds', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        if (calls === 1) throw makeError(config, 500);
        return makeResponse(config, { data: '<html>ok</html>' });
    };
    const client = buildClient({ adapter, retryDelayMs: 1 });
    const resp = await client.get('https://www.douyin.com/video/123');
    assert.equal(calls, 2);
    assert.equal(resp.status, 200);
    assert.equal(resp.data, '<html>ok</html>');
});

test('retries a network error (no response) then succeeds', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        if (calls === 1) throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
        return makeResponse(config);
    };
    const client = buildClient({ adapter, retryDelayMs: 1 });
    const resp = await client.get('https://www.douyin.com/video/123');
    assert.equal(calls, 2);
    assert.equal(resp.status, 200);
});

test('stops retrying after maxRetries and rethrows the raw error', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        throw makeError(config, 500);
    };
    const client = buildClient({ adapter, maxRetries: 2, retryDelayMs: 1 });
    await assert.rejects(
        client.get('https://www.douyin.com/video/123'),
        (err) => err.response?.status === 500
    );
    assert.equal(calls, 3); // initial + 2 retries
});

test('logs "request failed — retrying" on each retry', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        if (calls === 1) throw makeError(config, 503);
        return makeResponse(config);
    };
    const store = { info: [], warn: [], error: [] };
    const client = buildClient({ adapter, retryDelayMs: 1, logger: captureLogger(store) });
    await client.get('https://www.douyin.com/video/123');
    assert.ok(store.warn.some((m) => m.includes('retrying')), `warns=${JSON.stringify(store.warn)}`);
});

/* ------------------------------------------------------------------ */
/* Error mapping                                                       */
/* ------------------------------------------------------------------ */

test('401 maps to DouyinAuthenticationException and is NOT retried', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        throw makeError(config, 401);
    };
    const store = { info: [], warn: [], error: [] };
    const client = buildClient({ adapter, maxRetries: 3, retryDelayMs: 1, logger: captureLogger(store) });
    await assert.rejects(
        client.get('https://www.douyin.com/video/123'),
        (err) =>
            err instanceof DouyinAuthenticationException &&
            err.code === 'DOUYIN_AUTH_FAILED' &&
            err.status === 401
    );
    assert.equal(calls, 1);
    assert.ok(store.error.some((m) => m.includes('authentication failure')));
});

test('403 maps to DouyinAuthenticationException', async () => {
    const adapter = async (config) => {
        throw makeError(config, 403);
    };
    const client = buildClient({ adapter });
    await assert.rejects(client.get('https://www.douyin.com/video/123'), DouyinAuthenticationException);
});

test('429 maps to DouyinRateLimitException after retries are exhausted', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        throw makeError(config, 429, { 'retry-after': '1' });
    };
    const client = buildClient({ adapter, maxRetries: 2, retryDelayMs: 1 });
    await assert.rejects(
        client.get('https://www.douyin.com/video/123'),
        (err) =>
            err instanceof DouyinRateLimitException &&
            err.code === 'DOUYIN_RATE_LIMITED' &&
            err.status === 429 &&
            err.retryAfter === 1000
    );
    assert.equal(calls, 3);
});

test('429 with Retry-After succeeds on retry', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        if (calls === 1) throw makeError(config, 429, { 'retry-after': '1' });
        return makeResponse(config);
    };
    const client = buildClient({ adapter, maxRetries: 2, retryDelayMs: 1 });
    const resp = await client.get('https://www.douyin.com/video/123');
    assert.equal(calls, 2);
    assert.equal(resp.status, 200);
});

test('logs "rate limited ... retrying" before a successful retry', async () => {
    let calls = 0;
    const adapter = async (config) => {
        calls += 1;
        if (calls === 1) throw makeError(config, 429);
        return makeResponse(config);
    };
    const store = { info: [], warn: [], error: [] };
    const client = buildClient({ adapter, retryDelayMs: 1, logger: captureLogger(store) });
    await client.get('https://www.douyin.com/video/123');
    assert.ok(store.warn.some((m) => m.includes('rate limited') && m.includes('retrying')));
});

/* ------------------------------------------------------------------ */
/* Cookie requirement                                                  */
/* ------------------------------------------------------------------ */

test('requireCookie + empty cookies throws DouyinCookieMissingException at construction', () => {
    assert.throws(
        () => buildClient({ requireCookie: true, cookies: '' }),
        DouyinCookieMissingException
    );
});

test('requireCookie is waived in mock mode', () => {
    const config = {
        cookies: '',
        requireCookie: true,
        mock: true,
        httpProxy: '',
        httpsProxy: '',
        userAgent: 'UA',
        timeoutMs: 1000,
        downloadTimeoutMs: 1000,
        maxRetries: 1,
        retryDelayMs: 1,
        rateLimitMs: 0,
    };
    const client = new DouyinHttpClient({ config, logger: silentLogger });
    assert.equal(client.hasCookies, false);
});

test('logs "cookie loaded (N cookie pairs)" without exposing values', () => {
    const store = { info: [], warn: [], error: [] };
    const client = buildClient({
        cookies: 'sessionid=SECRETVALUE; ttwid=OTHER',
        logger: captureLogger(store),
    });
    assert.ok(client.hasCookies);
    const joined = store.info.join(' ');
    assert.match(joined, /cookie loaded \(2 cookie pairs\)/);
    assert.ok(!joined.includes('SECRETVALUE'));
    assert.ok(!joined.includes('OTHER'));
});

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

test('rate limiting spaces successive requests', async () => {
    const adapter = async (config) => makeResponse(config);
    const client = buildClient({ adapter, rateLimitMs: 250 });
    const start = Date.now();
    await client.get('https://www.douyin.com/a');
    await client.get('https://www.douyin.com/b');
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 200, `elapsed=${elapsed}ms`);
});

/* ------------------------------------------------------------------ */
/* Proxy parsing                                                       */
/* ------------------------------------------------------------------ */

test('parseProxyUrl parses host/port/auth', () => {
    const proxy = parseProxyUrl('http://user:pass@proxy.example.com:8080');
    assert.equal(proxy.protocol, 'http:');
    assert.equal(proxy.host, 'proxy.example.com');
    assert.equal(proxy.port, 8080);
    assert.deepEqual(proxy.auth, { username: 'user', password: 'pass' });
});

test('parseProxyUrl returns null for empty/invalid values', () => {
    assert.equal(parseProxyUrl(''), null);
    assert.equal(parseProxyUrl('   '), null);
    assert.equal(parseProxyUrl('not a url'), null);
});

test('client logs "proxy enabled" with host:port but not credentials', () => {
    const store = { info: [], warn: [], error: [] };
    const client = buildClient({
        proxy: 'http://user:secret@proxy.example.com:8080',
        logger: captureLogger(store),
    });
    assert.equal(client.proxy.host, 'proxy.example.com');
    const joined = store.info.join(' ');
    assert.match(joined, /proxy enabled/);
    assert.ok(joined.includes('proxy.example.com:8080'));
    assert.ok(!joined.includes('user'));
    assert.ok(!joined.includes('secret'));
});

/* ------------------------------------------------------------------ */
/* Helper functions                                                    */
/* ------------------------------------------------------------------ */

test('parseRetryAfter handles seconds and HTTP dates', () => {
    assert.equal(parseRetryAfter('5'), 5000);
    assert.equal(parseRetryAfter(undefined), null);
    const future = new Date(Date.now() + 3000).toUTCString();
    const ms = parseRetryAfter(future);
    assert.ok(ms >= 2000 && ms <= 5000);
});

test('sanitizeMessage strips URLs before logging', () => {
    const cleaned = sanitizeMessage('connect to https://evil.com/x?token=abc failed');
    assert.ok(!cleaned.includes('https://'));
    assert.ok(!cleaned.includes('token=abc'));
});
