/**
 * douyin-cookies.js
 * ----------------------------------------------------------------------------
 * Cookie parsing + validation for the Douyin Downloader feature.
 *
 * Supported input formats for `DOUYIN_COOKIES`:
 *   1. Cookie header string: "sessionid=xxx; ttwid=xxx; msToken=xxx"
 *   2. JSON array of cookie objects: [ { "name": "sessionid", "value": "xxx" } ]
 *
 * Validation rules (all throw DouyinCookieMissingException):
 *   - empty cookie        -> DOUYIN_COOKIES unset/blank
 *   - malformed string    -> no valid "name=value" pairs could be parsed
 *   - missing sessionid   -> the required authentication cookie is absent
 *
 * NOTE: these helpers never log actual cookie values — only names/counts.
 */

import { DouyinCookieMissingException } from './douyin-errors.js';

/** Cookies that must be present for an authenticated request. */
export const REQUIRED_COOKIES = ['sessionid'];

/** Cookies that are recommended (but not required) for anti-bot bypass. */
export const RECOMMENDED_COOKIES = ['ttwid', 'msToken'];

/**
 * Parse a raw DOUYIN_COOKIES value into an array of { name, value } pairs.
 * Returns [] for empty or unparseable input (never throws).
 * @param {string|undefined} raw
 * @returns {Array<{name: string, value: string}>}
 */
export function parseCookieString(raw) {
    if (!raw) return [];
    const trimmed = String(raw).trim();
    if (!trimmed) return [];

    // JSON array format.
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) {
                return arr
                    .filter((c) => c && c.name !== undefined && c.value !== undefined)
                    .map((c) => ({ name: String(c.name), value: String(c.value) }));
            }
        } catch {
            /* invalid JSON — fall through to header-string parsing */
        }
        return [];
    }

    // Header-string format: "name=value; name=value".
    const pairs = [];
    for (const part of trimmed.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const name = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        if (name) pairs.push({ name, value });
    }
    return pairs;
}

/**
 * Build a ready-to-send `Cookie` header value from raw input, or '' when there
 * are no parseable cookies.
 * @param {string|undefined} raw
 * @returns {string}
 */
export function normalizeCookieHeader(raw) {
    return parseCookieString(raw)
        .map((p) => `${p.name}=${p.value}`)
        .join('; ');
}

/**
 * @param {string|undefined} raw
 * @returns {number} number of parseable cookie pairs
 */
export function countCookiePairs(raw) {
    return parseCookieString(raw).length;
}

/**
 * Validate raw cookie input. Throws DouyinCookieMissingException on:
 *   - empty/blank value
 *   - malformed value (no parseable "name=value" pairs)
 *   - missing a required cookie (sessionid)
 *
 * On success returns `{ pairs, missingRecommended }` (names only).
 * @param {string|undefined} raw
 * @returns {{ pairs: Array<{name:string,value:string}>, missingRecommended: string[] }}
 */
export function validateCookies(raw) {
    const trimmed = String(raw || '').trim();

    if (!trimmed) {
        throw new DouyinCookieMissingException(
            'DOUYIN_COOKIES is empty — set it to a valid Douyin session cookie, e.g. "sessionid=...; ttwid=..."'
        );
    }

    const pairs = parseCookieString(trimmed);
    if (pairs.length === 0) {
        throw new DouyinCookieMissingException(
            'DOUYIN_COOKIES is malformed — expected "name=value; name=value" pairs or a JSON array of {name, value}'
        );
    }

    const names = new Set(pairs.map((p) => p.name.toLowerCase()));
    const missing = REQUIRED_COOKIES.filter((name) => !names.has(name.toLowerCase()));
    if (missing.length > 0) {
        throw new DouyinCookieMissingException(
            `DOUYIN_COOKIES is missing required cookie(s): ${missing.join(', ')}`
        );
    }

    const missingRecommended = RECOMMENDED_COOKIES.filter((name) => !names.has(name.toLowerCase()));
    return { pairs, missingRecommended };
}

export default {
    REQUIRED_COOKIES,
    RECOMMENDED_COOKIES,
    parseCookieString,
    normalizeCookieHeader,
    countCookiePairs,
    validateCookies,
};
