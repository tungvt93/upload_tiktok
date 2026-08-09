/**
 * douyin.config.js
 * ----------------------------------------------------------------------------
 * Configuration module for the Douyin Downloader feature.
 *
 * This is the project's plain-JS equivalent of a NestJS `ConfigModule`: it
 * centralises reading + validating environment variables and exposes a single
 * frozen, typed configuration object consumed by the rest of the feature.
 *
 * It ships with a tiny zero-dependency `.env` loader so you can configure the
 * feature from a `.env` file (in the backend dir or the repo root) without
 * pulling in a dotenv dependency.
 *
 * Environment variables:
 *   DOUYIN_COOKIES             - browser cookies from a logged-in Douyin session.
 *                                Format: "sessionid=xxx;ttwid=xxx;msToken=xxx"
 *                                or a JSON array of { "name": "...", "value": "..." }.
 *   HTTP_PROXY / HTTPS_PROXY   - optional proxy URL, e.g. http://user:pass@host:port
 *   DOUYIN_REQUIRE_COOKIE      - "1"/"true" to fail fast when no valid cookie is set
 *   DOUYIN_USER_AGENT          - override the browser User-Agent
 *   DOUYIN_TIMEOUT_MS          - per-request timeout (default 20000)
 *   DOUYIN_DOWNLOAD_TIMEOUT_MS - timeout for video stream downloads (default 600000)
 *   DOUYIN_MAX_RETRIES         - retry count for transient failures (default 3)
 *   DOUYIN_RETRY_DELAY_MS      - base backoff delay between retries (default 1000)
 *   DOUYIN_RATE_LIMIT_MS       - minimum spacing between successive requests, 0 = off
 *   DOUYIN_MOCK                - "1" = offline demo mode (no network)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ */
/* .env loader (zero-dependency)                                       */
/* ------------------------------------------------------------------ */

/**
 * Load a `.env` file into `process.env` without overriding existing values.
 * Checks (in order): cwd, backend/config, backend, repo root.
 * Returns the path that was loaded, or null.
 */
export function loadDotenv(cwd = process.cwd()) {
    const candidates = [
        path.join(cwd, '.env'),
        path.join(__dirname, '.env'),
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', '..', '.env'),
    ];
    for (const file of candidates) {
        try {
            if (!fs.existsSync(file)) continue;
            const content = fs.readFileSync(file, 'utf8');
            for (const rawLine of content.split(/\r?\n/)) {
                const line = rawLine.trim();
                if (!line || line.startsWith('#')) continue;
                const eq = line.indexOf('=');
                if (eq === -1) continue;
                const key = line.slice(0, eq).trim();
                let value = line.slice(eq + 1).trim();
                if (
                    (value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))
                ) {
                    value = value.slice(1, -1);
                }
                if (key && !(key in process.env)) process.env[key] = value;
            }
            return file;
        } catch {
            /* skip unreadable .env files */
        }
    }
    return null;
}

let dotenvLoaded = false;
function ensureDotenv() {
    if (!dotenvLoaded) {
        loadDotenv();
        dotenvLoaded = true;
    }
}

/* ------------------------------------------------------------------ */
/* Config accessor                                                     */
/* ------------------------------------------------------------------ */

function intVal(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function boolVal(value) {
    return value === '1' || String(value).toLowerCase() === 'true';
}

/**
 * Build the frozen Douyin config object from an environment map.
 * Defaults to `process.env` (after a one-time .env load).
 */
export function loadDouyinConfig(env = process.env) {
    ensureDotenv();
    const e = env || {};
    const config = {
        cookies: String(e.DOUYIN_COOKIES || '').trim(),
        httpProxy: String(e.HTTP_PROXY || e.http_proxy || '').trim(),
        httpsProxy: String(e.HTTPS_PROXY || e.https_proxy || '').trim(),
        requireCookie: boolVal(e.DOUYIN_REQUIRE_COOKIE),
        userAgent: String(e.DOUYIN_USER_AGENT || DEFAULT_USER_AGENT).trim(),
        mock: e.DOUYIN_MOCK === '1',
        timeoutMs: intVal(e.DOUYIN_TIMEOUT_MS, 20000),
        downloadTimeoutMs: intVal(e.DOUYIN_DOWNLOAD_TIMEOUT_MS, 600000),
        maxRetries: intVal(e.DOUYIN_MAX_RETRIES, 3),
        retryDelayMs: intVal(e.DOUYIN_RETRY_DELAY_MS, 1000),
        rateLimitMs: intVal(e.DOUYIN_RATE_LIMIT_MS, 0),
    };
    return Object.freeze(config);
}

export const douyinConfig = loadDouyinConfig();

export default { loadDotenv, loadDouyinConfig, douyinConfig, DEFAULT_USER_AGENT };
