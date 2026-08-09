/**
 * douyin-http-client.js
 * ----------------------------------------------------------------------------
 * Reusable HTTP client for Douyin requests.
 *
 * Responsibilities:
 *   - inject DOUYIN_COOKIES automatically (validated on construction)
 *   - inject browser-like default headers (UA, Referer, Accept, Accept-Language)
 *   - support HTTP_PROXY / HTTPS_PROXY
 *   - handle per-request timeouts
 *   - retry transient failures (network errors, 5xx, 429) with exponential backoff
 *   - rate limiting (optional minimum spacing between successive requests)
 *   - map failures to typed exceptions:
 *       DouyinCookieMissingException   - no/invalid cookie configured
 *       DouyinAuthenticationException  - 401/403 from Douyin
 *       DouyinRateLimitException       - 429 from Douyin
 *
 * Logging (never logs raw cookie values):
 *   - "cookie loaded"           once, when a valid cookie is configured
 *   - "no DOUYIN_COOKIES..."    warning when anonymous mode is used
 *   - "proxy enabled"           once, when a proxy is configured
 *   - "request failed — retrying" on each retry attempt
 *   - "authentication failure"  on 401/403
 */

import axios from 'axios';
import { loadDouyinConfig } from './config/douyin.config.js';
import { normalizeCookieHeader, validateCookies, countCookiePairs } from './douyin-cookies.js';
import {
    DouyinAuthenticationException,
    DouyinRateLimitException,
} from './douyin-errors.js';

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: 'https://www.douyin.com/',
    Accept: 'application/json,text/html,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
};

// HTTP statuses worth retrying (transient / rate-limit).
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultLogger = {
    info: (...args) => console.log('[DouyinHttpClient]', ...args),
    warn: (...args) => console.warn('[DouyinHttpClient]', ...args),
    error: (...args) => console.error('[DouyinHttpClient]', ...args),
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a proxy URL into the shape axios expects: { protocol, host, port, auth }.
 * Returns null when the value is empty/invalid.
 */
export function parseProxyUrl(raw) {
    if (!raw) return null;
    const value = String(raw).trim();
    if (!value) return null;
    try {
        const u = new URL(value);
        const proxy = {
            protocol: u.protocol,
            host: u.hostname,
            port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
        };
        if (u.username || u.password) {
            proxy.auth = {
                username: decodeURIComponent(u.username),
                password: decodeURIComponent(u.password),
            };
        }
        return proxy;
    } catch {
        return null;
    }
}

/** Parse a `Retry-After` header (seconds or HTTP-date) into ms, or null. */
export function parseRetryAfter(value) {
    if (!value) return null;
    const seconds = Number.parseFloat(String(value));
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    const t = Date.parse(String(value));
    return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}

/** Redact any URL-looking substring from an error message before logging. */
export function sanitizeMessage(message) {
    return String(message).replace(/https?:\/\/\S+/gi, '[url]');
}

function isNetworkError(err) {
    // Axios network/timeout errors have no response; adapter errors surface as
    // err.code in ('ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND',
    // 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE'...).
    if (!err.response) return true;
    return false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export class DouyinHttpClient {
    /**
     * @param {object} [options]
     * @param {object} [options.config]        frozen config from loadDouyinConfig()
     * @param {object} [options.logger]        { info, warn, error } logging surface
     * @param {object} [options.headers]       extra default headers to merge in
     * @param {Function} [options.adapter]     axios adapter override (testing)
     */
    constructor(options = {}) {
        const config = options.config || loadDouyinConfig();
        this.config = config;
        this.logger = options.logger || defaultLogger;

        /* ---- cookies ---- */
        this.cookieHeader = normalizeCookieHeader(config.cookies);
        if (this.cookieHeader) {
            // Validates & throws DouyinCookieMissingException when empty/malformed/
            // missing sessionid. Never logs the actual values.
            const { missingRecommended } = validateCookies(config.cookies);
            this.logger.info(`cookie loaded (${countCookiePairs(config.cookies)} cookie pairs)`);
            if (missingRecommended && missingRecommended.length > 0) {
                this.logger.warn(`cookie is missing recommended key(s): ${missingRecommended.join(', ')}`);
            }
        } else if (config.requireCookie && !config.mock) {
            // Fail fast at construction time when a cookie is mandatory.
            validateCookies('');
        } else {
            this.logger.warn('no DOUYIN_COOKIES configured — requests will be anonymous');
        }

        /* ---- proxy ---- */
        this.proxy = parseProxyUrl(config.httpsProxy) || parseProxyUrl(config.httpProxy);
        if (this.proxy) {
            const auth = this.proxy.auth ? ':with-auth' : '';
            this.logger.info(`proxy enabled (${this.proxy.protocol}//${this.proxy.host}:${this.proxy.port}${auth})`);
        } else {
            this.logger.info('proxy disabled');
        }

        /* ---- axios instance ---- */
        const headers = {
            ...DEFAULT_HEADERS,
            'User-Agent': config.userAgent || DEFAULT_HEADERS['User-Agent'],
            ...(options.headers || {}),
        };
        if (this.cookieHeader) headers.Cookie = this.cookieHeader;

        const axiosOptions = {
            timeout: config.timeoutMs,
            proxy: this.proxy || false,
            headers,
        };
        if (options.adapter) axiosOptions.adapter = options.adapter;
        this.http = axios.create(axiosOptions);

        this.maxRetries = config.maxRetries;
        this.retryDelayMs = config.retryDelayMs;
        this.rateLimitMs = config.rateLimitMs;
        this._lastRequestAt = 0;
    }

    /** @returns {boolean} whether a Cookie header is attached to requests */
    get hasCookies() {
        return Boolean(this.cookieHeader);
    }

    /** @returns {number} how many cookie pairs are attached */
    get cookieCount() {
        return countCookiePairs(this.config.cookies);
    }

    /* ---- rate limiting ---- */

    async _respectRateLimit() {
        if (!this.rateLimitMs) return;
        const now = Date.now();
        const wait = this.rateLimitMs - (now - this._lastRequestAt);
        if (wait > 0) await sleep(wait);
        this._lastRequestAt = Date.now();
    }

    /* ---- backoff ---- */

    async _backoff(attempt, retryAfterMs) {
        const base = retryAfterMs ?? this.retryDelayMs;
        const jitter = Math.floor(Math.random() * 250);
        const delay = Math.min(30000, base * 2 ** attempt + jitter);
        await sleep(delay);
    }

    /* ---- core request ---- */

    /**
     * Perform a request with retries, timeout, rate limiting and error mapping.
     * @param {string|object} urlOrConfig  URL string or axios request config
     * @param {object} [extra]             extra config when a URL string is passed
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    async request(urlOrConfig, extra = {}) {
        const config = typeof urlOrConfig === 'string' ? { ...extra, url: urlOrConfig } : { ...urlOrConfig };
        const method = String(config.method || 'get').toUpperCase();
        const retries = config.retries ?? this.maxRetries;
        let attempt = 0;

        for (;;) {
            await this._respectRateLimit();
            try {
                return await this.http.request({ ...config, method });
            } catch (err) {
                const status = err.response?.status;

                // Authentication failures are not retryable.
                if (status === 401 || status === 403) {
                    this.logger.error(`authentication failure (HTTP ${status}) for ${method} ${redactUrl(config.url)}`);
                    throw new DouyinAuthenticationException(
                        `Douyin rejected the request (HTTP ${status})${redactUrlSuffix(config.url)}`,
                        err
                    );
                }

                // Rate limited: honour Retry-After, retry until we exhaust attempts.
                if (status === 429) {
                    const retryAfter = parseRetryAfter(err.response?.headers?.['retry-after']);
                    if (attempt < retries) {
                        this.logger.warn(
                            `rate limited (HTTP 429) for ${method} ${redactUrl(config.url)} — retrying (${attempt + 1}/${retries})`
                        );
                        await this._backoff(attempt, retryAfter);
                        attempt += 1;
                        continue;
                    }
                    throw new DouyinRateLimitException('Douyin rate limited the request', retryAfter);
                }

                const retryable = !status || RETRYABLE_STATUS.has(status) || isNetworkError(err);
                if (retryable && attempt < retries) {
                    this.logger.warn(
                        `request failed (${sanitizeMessage(err.message || err.code || 'error')}) for ${method} ${redactUrl(config.url)} — retrying (${attempt + 1}/${retries})`
                    );
                    await this._backoff(attempt);
                    attempt += 1;
                    continue;
                }
                throw err;
            }
        }
    }

    /** GET convenience wrapper. */
    get(url, config = {}) {
        return this.request({ ...config, url, method: 'GET' });
    }
}

/** Trim query strings that may contain tokens before logging a URL. */
function redactUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        u.search = '';
        return u.toString();
    } catch {
        return String(url).split('?')[0];
    }
}

function redactUrlSuffix(url) {
    const r = redactUrl(url);
    return r ? ` for ${r}` : '';
}

export default { DouyinHttpClient, parseProxyUrl, parseRetryAfter, sanitizeMessage, DEFAULT_HEADERS };
