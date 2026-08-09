/**
 * douyin-errors.js
 * ----------------------------------------------------------------------------
 * Typed exceptions for the Douyin Downloader feature. All exceptions extend a
 * common `DouyinError` base so callers can catch the whole family with one
 * `instanceof` check, and each carries a machine-readable `code` plus an HTTP
 * `status` suitable for API responses.
 */

export class DouyinError extends Error {
    /**
     * @param {string} message  human-readable description
     * @param {object} [options]
     * @param {string} [options.code]   machine-readable error code
     * @param {number} [options.status] HTTP status the error maps to
     * @param {Error}  [options.cause]  underlying error (if any)
     */
    constructor(message, options = {}) {
        super(message);
        this.name = new.target.name;
        this.code = options.code || 'DOUYIN_ERROR';
        this.status = options.status || 500;
        if (options.cause !== undefined) this.cause = options.cause;
        // Ensure the prototype chain is intact when targeting ES2015+.
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when `DOUYIN_COOKIES` is empty, malformed, or missing a required
 * cookie (e.g. `sessionid`). Maps to HTTP 401.
 */
export class DouyinCookieMissingException extends DouyinError {
    constructor(message = 'DOUYIN_COOKIES is not configured') {
        super(message, { code: 'DOUYIN_COOKIE_MISSING', status: 401 });
    }
}

/**
 * Thrown when Douyin rejects a request with an authentication failure
 * (HTTP 401/403) — typically stale or expired cookies. Maps to HTTP 401.
 */
export class DouyinAuthenticationException extends DouyinError {
    constructor(message = 'Douyin rejected the request (authentication failure)', cause) {
        super(message, { code: 'DOUYIN_AUTH_FAILED', status: 401, cause });
    }
}

/**
 * Thrown when Douyin rate limits a request (HTTP 429). Maps to HTTP 429 and
 * carries the server-provided `retryAfter` (ms) when available.
 */
export class DouyinRateLimitException extends DouyinError {
    /**
     * @param {string} [message]
     * @param {number|null} [retryAfter] seconds suggested by the `Retry-After` header
     */
    constructor(message = 'Douyin rate limited the request', retryAfter = null) {
        super(message, { code: 'DOUYIN_RATE_LIMITED', status: 429 });
        this.retryAfter = retryAfter;
    }
}

export default {
    DouyinError,
    DouyinCookieMissingException,
    DouyinAuthenticationException,
    DouyinRateLimitException,
};
