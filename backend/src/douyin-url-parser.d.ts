/**
 * douyin-url-parser.d.ts
 * ----------------------------------------------------------------------------
 * Type declarations for the runtime implementation in `douyin-url-parser.js`.
 * The implementation is plain ESM JavaScript (importable by the Node runtime
 * without a build step); this file restores full type safety for TypeScript
 * consumers (the parser unit tests in `backend/tests/douyin-url-parser.test.ts`).
 * ----------------------------------------------------------------------------
 */

/** Kind of viewable Douyin resource the normalized result can describe. */
export type DouyinVideoType = 'video' | 'note';

/**
 * Normalized result returned by `extractVideoId`.
 *
 *   {
 *     id: string,            // aweme_id / note_id / short code
 *     type: "video" | "note",
 *     normalizedUrl: string, // canonical page URL for the resource
 *   }
 */
export interface VideoParseResult {
  /** Extracted resource id (aweme_id for videos, note_id for notes, or the short code). */
  id: string;
  /** Whether the resource is a video or a note. */
  type: DouyinVideoType;
  /** Canonical URL for the detected resource (e.g. https://www.douyin.com/video/{id}). */
  normalizedUrl: string;
}

/** Kind of Douyin resource a URL points to (full parse). */
export type DouyinUrlType = 'video' | 'note' | 'user' | 'short' | 'unknown';

/** Parsed representation of a Douyin URL (full parse). */
export interface ParsedDouyinUrl {
  /** Detected URL type (see `DouyinUrlType`). */
  type: DouyinUrlType;
  /**
   * Extracted resource id:
   *   - `video` -> aweme_id
   *   - `note`  -> note_id
   *   - `user`  -> sec_uid
   *   - `short` -> short link code
   *   - `unknown` -> null
   */
  id: string | null;
  /** The raw URL exactly as provided (trimmed of surrounding whitespace). */
  originalUrl: string;
  /** Canonical form of the URL for the detected type. */
  normalizedUrl: string;
}

/** Thrown when the input cannot be interpreted as a URL at all. */
export class DouyinUrlParseError extends Error {
  constructor(message: string);
}

/**
 * Parse a Douyin URL and return a typed, normalized description of it.
 * Throws {@link DouyinUrlParseError} when `input` is empty or not a valid URL.
 */
export function parseDouyinUrl(input: string): ParsedDouyinUrl;

/**
 * Extract the normalized result `{ id, type, normalizedUrl }` for any supported
 * video/note URL. Returns `null` when the URL does not point at a viewable
 * video/note. Never throws.
 *
 * Supported:
 *   - https://www.douyin.com/video/{id}
 *   - https://www.douyin.com/note/{id}
 *   - https://www.douyin.com/jingxuan?modal_id={id}
 *   - https://www.douyin.com/discover?modal_id={id}
 *   - https://www.douyin.com/user/{user}?modal_id={id}
 *   - https://v.douyin.com/{shortcode}
 */
export function extractVideoId(input: string): VideoParseResult | null;

/**
 * Extract the `modal_id` query parameter if present and numeric.
 * Returns `null` when absent or non-numeric.
 */
export function extractModalId(input: string): string | null;

/**
 * Extract the sec_uid from a Douyin user page. Returns `null` otherwise.
 */
export function extractSecUid(input: string): string | null;

/**
 * Strip fragments/hash and query string, keeping the path — i.e. turn
 * `https://www.douyin.com/video/123?a=1#top` into
 * `https://www.douyin.com/video/123`.
 */
export function normalizeDouyinUrl(input: string): string;
