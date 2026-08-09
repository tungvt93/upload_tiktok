/**
 * douyin-url-parser.js
 * ----------------------------------------------------------------------------
 * Production-ready Douyin URL parser.
 *
 * Plain ESM JavaScript so it can be imported directly by the Node runtime
 * (no build/transpile step). Type declarations for TypeScript consumers live
 * in `douyin-url-parser.d.ts` next to this file.
 *
 * Supported URL formats:
 *
 *   1. Short share link            -> https://v.douyin.com/{code}
 *   2. Video page                  -> https://www.douyin.com/video/{aweme_id}
 *   3. Note page                   -> https://www.douyin.com/note/{note_id}
 *   4. 精选 (jingxuan)              -> https://www.douyin.com/jingxuan?modal_id={aweme_id}
 *   5. Discover                    -> https://www.douyin.com/discover?modal_id={aweme_id}
 *   6. User page with open modal   -> https://www.douyin.com/user/{sec_uid}?modal_id={aweme_id}
 *
 * `modal_id` query parameters are extracted automatically, and any URL carrying
 * a `modal_id` is converted into a standard **video** object (the modal shows a
 * video/post detail regardless of the page it is opened from).
 *
 * Public API:
 *   - parseDouyinUrl(input)          -> { type, id, originalUrl, normalizedUrl }
 *   - extractVideoId(input)          -> { id, type, normalizedUrl } | null
 *   - extractModalId(input)          -> string | null
 *   - extractSecUid(input)           -> string | null
 *   - normalizeDouyinUrl(input)      -> string
 *   - class DouyinUrlParseError
 *
 * Example:
 *   Input:  https://www.douyin.com/jingxuan?modal_id=7655697736649526574
 *   Output: { id: '7655697736649526574', type: 'video',
 *             normalizedUrl: 'https://www.douyin.com/video/7655697736649526574' }
 *
 * The module is dependency-free and relies only on the WHATWG `URL` global
 * available in Node.js >= 10.
 * ----------------------------------------------------------------------------
 */

/** @typedef {'video' | 'note'} DouyinVideoType */

/* ------------------------------------------------------------------ */
/* Patterns                                                            */
/* ------------------------------------------------------------------ */

// Matches the Douyin host family: douyin.com, www.douyin.com, v.douyin.com,
// m.douyin.com, iesdouyin.com, www.iesdouyin.com, ...
const DOUYIN_HOST_RE = /(?:^|\.)(?:douyin|iesdouyin)\.com$/i;

// v.douyin.com (and mobile short-link hosts) carry the opaque short code.
const SHORT_HOST_RE = /(?:^|\.)(?:v|mobile)\.douyin\.com$/i;

// /video/{aweme_id} and legacy /share/video/{aweme_id}
const VIDEO_PATH_RE = /^\/(?:video|share\/video)\/(\d+)/i;

// /note/{note_id}
const NOTE_PATH_RE = /^\/note\/(\d+)/i;

// /user/{sec_uid} — sec_uid is an opaque base64-ish token; accept any non-empty
// path segment up to the next delimiter.
const USER_PATH_RE = /^\/user\/([^/?#]+)/i;

// Opaque short code (letters/digits/underscores/hyphens).
const SHORT_CODE_RE = /^([\w-]+)$/;

// aweme_id / note_id / modal_id are always numeric.
const NUMERIC_ID_RE = /^\d+$/;

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse `input` into a WHATWG URL, tolerating scheme-less and
 * protocol-relative forms. Returns `null` for unparseable input.
 * @param {string} input
 * @returns {URL | null}
 */
function parseUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return null;

  // Accept protocol-relative and scheme-less forms.
  if (raw.startsWith('//')) raw = `https:${raw}`;
  else if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isDouyinHost(hostname) {
  return DOUYIN_HOST_RE.test(hostname);
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isShortHost(hostname) {
  return SHORT_HOST_RE.test(hostname);
}

/**
 * @param {string} id
 * @returns {string}
 */
function toVideoUrl(id) {
  return `https://www.douyin.com/video/${id}`;
}

/**
 * @param {string} id
 * @returns {string}
 */
function toNoteUrl(id) {
  return `https://www.douyin.com/note/${id}`;
}

/**
 * @param {string} secUid
 * @returns {string}
 */
function toUserUrl(secUid) {
  return `https://www.douyin.com/user/${secUid}`;
}

/**
 * @param {string} code
 * @returns {string}
 */
function toShortUrl(code) {
  return `https://v.douyin.com/${code}`;
}

/**
 * @param {string} originalUrl
 * @returns {import('./douyin-url-parser.d.ts').ParsedDouyinUrl}
 */
function unknownResult(originalUrl) {
  return { type: 'unknown', id: null, originalUrl, normalizedUrl: originalUrl };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Thrown when the input cannot be interpreted as a URL at all
 * (empty string, malformed input, etc.).
 */
export class DouyinUrlParseError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'DouyinUrlParseError';
  }
}

/**
 * Parse a Douyin URL and return a typed, normalized description of it.
 *
 * Rules, in priority order:
 *   1. A `modal_id` query parameter always yields a **video** object
 *      (`normalizedUrl` = https://www.douyin.com/video/{modal_id}).
 *   2. Short share links (https://v.douyin.com/{code}) are detected as `short`.
 *   3. `/video/{id}` (and legacy `/share/video/{id}`) -> `video`.
 *   4. `/note/{id}`                                    -> `note`.
 *   5. `/user/{sec_uid}`                               -> `user`.
 *   6. Everything else on a douyin host               -> `unknown`.
 *
 * @param {string} input Raw URL (with or without scheme).
 * @returns {import('./douyin-url-parser.d.ts').ParsedDouyinUrl}
 * @throws {DouyinUrlParseError} when `input` is empty or not a valid URL.
 */
export function parseDouyinUrl(input) {
  const url = parseUrl(input);
  if (!url) {
    throw new DouyinUrlParseError(`Invalid Douyin URL: "${String(input ?? '').trim()}"`);
  }

  const originalUrl = String(input ?? '').trim();

  if (!isDouyinHost(url.hostname)) {
    // Well-formed URL, but not a Douyin resource.
    return unknownResult(originalUrl);
  }

  // 1) modal_id query parameter -> standard video object.
  const modalId = url.searchParams.get('modal_id');
  if (modalId && NUMERIC_ID_RE.test(modalId)) {
    return {
      type: 'video',
      id: modalId,
      originalUrl,
      normalizedUrl: toVideoUrl(modalId),
    };
  }

  const path = url.pathname;

  // 2) Short share link: https://v.douyin.com/{code}
  if (isShortHost(url.hostname)) {
    const code = path.replace(/^\/+/, '').split('/')[0] ?? '';
    if (SHORT_CODE_RE.test(code)) {
      return {
        type: 'short',
        id: code,
        originalUrl,
        normalizedUrl: toShortUrl(code),
      };
    }
    return unknownResult(originalUrl);
  }

  // 3) /video/{aweme_id} or /share/video/{aweme_id}
  let match = path.match(VIDEO_PATH_RE);
  if (match && match[1]) {
    return { type: 'video', id: match[1], originalUrl, normalizedUrl: toVideoUrl(match[1]) };
  }

  // 4) /note/{note_id}
  match = path.match(NOTE_PATH_RE);
  if (match && match[1]) {
    return { type: 'note', id: match[1], originalUrl, normalizedUrl: toNoteUrl(match[1]) };
  }

  // 5) /user/{sec_uid}
  match = path.match(USER_PATH_RE);
  if (match && match[1]) {
    return { type: 'user', id: match[1], originalUrl, normalizedUrl: toUserUrl(match[1]) };
  }

  // 6) Recognized douyin host but no matching pattern.
  return unknownResult(originalUrl);
}

/**
 * Extract the normalized result for any supported video/note URL.
 *
 * Supported inputs:
 *   - https://www.douyin.com/video/{id}                       -> video
 *   - https://www.douyin.com/note/{id}                        -> note
 *   - https://www.douyin.com/jingxuan?modal_id={id}           -> video
 *   - https://www.douyin.com/discover?modal_id={id}           -> video
 *   - https://www.douyin.com/user/{user}?modal_id={id}        -> video
 *   - https://v.douyin.com/{shortcode}                        -> video
 *     (the short code is returned as the id; it must be resolved via HTTP
 *      to obtain the real numeric aweme_id)
 *
 * Returns `null` when the URL does not point at a viewable video/note
 * (user page without modal, unknown host, malformed input, ...). Never throws.
 *
 * @param {string} input
 * @returns {import('./douyin-url-parser.d.ts').VideoParseResult | null}
 */
export function extractVideoId(input) {
  try {
    const parsed = parseDouyinUrl(input);
    if (parsed.type === 'video' || parsed.type === 'note') {
      return { id: parsed.id, type: parsed.type, normalizedUrl: parsed.normalizedUrl };
    }
    if (parsed.type === 'short') {
      return { id: parsed.id, type: 'video', normalizedUrl: parsed.normalizedUrl };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the `modal_id` query parameter if present and numeric.
 * Returns `null` when absent or non-numeric.
 *
 * @param {string} input
 * @returns {string | null}
 */
export function extractModalId(input) {
  const url = parseUrl(input);
  if (!url) return null;
  const modalId = url.searchParams.get('modal_id');
  return modalId && NUMERIC_ID_RE.test(modalId) ? modalId : null;
}

/**
 * Extract the sec_uid from a Douyin user page. Returns `null` otherwise.
 *
 * @param {string} input
 * @returns {string | null}
 */
export function extractSecUid(input) {
  try {
    const parsed = parseDouyinUrl(input);
    return parsed.type === 'user' ? parsed.id : null;
  } catch {
    return null;
  }
}

/**
 * Strip fragments/hash and query string, keeping the path — i.e. turn
 * `https://www.douyin.com/video/123?a=1#top` into
 * `https://www.douyin.com/video/123`. Used when resolving short links to the
 * canonical share page before fetching metadata.
 *
 * @param {string} input
 * @returns {string}
 */
export function normalizeDouyinUrl(input) {
  const url = parseUrl(input);
  if (!url) return String(input ?? '').trim();
  url.hash = '';
  url.search = '';
  return url.toString();
}

export default {
  parseDouyinUrl,
  extractVideoId,
  extractModalId,
  extractSecUid,
  normalizeDouyinUrl,
  DouyinUrlParseError,
};
