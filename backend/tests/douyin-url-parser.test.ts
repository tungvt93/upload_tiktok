/**
 * douyin-url-parser.test.ts — unit tests for the Douyin URL parser.
 *
 * The implementation lives in `backend/src/douyin-url-parser.js` (plain ESM so
 * the Node runtime can import it); types are provided by the sibling
 * `douyin-url-parser.d.ts`. Tests run through tsx.
 *
 * Usage:
 *   npm run test:url-parser
 *   npm run typecheck
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseDouyinUrl,
    extractVideoId,
    extractModalId,
    extractSecUid,
    normalizeDouyinUrl,
    DouyinUrlParseError,
    type ParsedDouyinUrl,
    type VideoParseResult,
} from '../src/douyin-url-parser.js';

const VIDEO_ID = '7655697736649526574';
const NOTE_ID = '7345678901234567890';
const USER_UID = 'MS4wLjABAAAAmY4QvP2Iq7z1XJ4k9cL6nT3sR5vB8dH0fG';
const SHORT_CODE = 'ABC123';

/* ------------------------------------------------------------------ */
/* 1. Short share links: https://v.douyin.com/{shortcode}              */
/* ------------------------------------------------------------------ */

test('extractVideoId: short link https://v.douyin.com/{shortcode}', () => {
    const input = `https://v.douyin.com/${SHORT_CODE}`;
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: SHORT_CODE,
        type: 'video',
        normalizedUrl: `https://v.douyin.com/${SHORT_CODE}`,
    });
});

test('short link: code with underscore/hyphen and trailing slash', () => {
    const input = 'https://v.douyin.com/Abc_123-xyz/';
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: 'Abc_123-xyz',
        type: 'video',
        normalizedUrl: 'https://v.douyin.com/Abc_123-xyz',
    });
});

test('short link: scheme-less input is accepted', () => {
    const result = extractVideoId(`v.douyin.com/${SHORT_CODE}`);
    assert.deepEqual(result, {
        id: SHORT_CODE,
        type: 'video',
        normalizedUrl: `https://v.douyin.com/${SHORT_CODE}`,
    });
});

test('parseDouyinUrl: short link has type "short"', () => {
    const parsed = parseDouyinUrl(`https://v.douyin.com/${SHORT_CODE}`);
    assert.equal(parsed.type, 'short');
    assert.equal(parsed.id, SHORT_CODE);
    assert.equal(parsed.originalUrl, `https://v.douyin.com/${SHORT_CODE}`);
    assert.equal(parsed.normalizedUrl, `https://v.douyin.com/${SHORT_CODE}`);
});

/* ------------------------------------------------------------------ */
/* 2. Video pages: https://www.douyin.com/video/{id}                   */
/* ------------------------------------------------------------------ */

test('extractVideoId: video page https://www.douyin.com/video/{id}', () => {
    const input = `https://www.douyin.com/video/${VIDEO_ID}`;
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: VIDEO_ID,
        type: 'video',
        normalizedUrl: `https://www.douyin.com/video/${VIDEO_ID}`,
    });
});

test('video page: legacy /share/video/{id} path resolves to a video', () => {
    const result = extractVideoId(`https://www.douyin.com/share/video/${VIDEO_ID}`);
    assert.deepEqual(result, {
        id: VIDEO_ID,
        type: 'video',
        normalizedUrl: `https://www.douyin.com/video/${VIDEO_ID}`,
    });
});

test('video page with extra query/hash is normalized cleanly', () => {
    const result = extractVideoId(`https://www.douyin.com/video/${VIDEO_ID}?from=feed#top`);
    assert.deepEqual(result, {
        id: VIDEO_ID,
        type: 'video',
        normalizedUrl: `https://www.douyin.com/video/${VIDEO_ID}`,
    });
});

/* ------------------------------------------------------------------ */
/* 3. Note pages: https://www.douyin.com/note/{id}                     */
/* ------------------------------------------------------------------ */

test('extractVideoId: note page https://www.douyin.com/note/{id}', () => {
    const input = `https://www.douyin.com/note/${NOTE_ID}`;
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: NOTE_ID,
        type: 'note',
        normalizedUrl: `https://www.douyin.com/note/${NOTE_ID}`,
    });
});

test('parseDouyinUrl: note page has type "note"', () => {
    const parsed = parseDouyinUrl(`https://www.douyin.com/note/${NOTE_ID}`);
    assert.equal(parsed.type, 'note');
    assert.equal(parsed.id, NOTE_ID);
    assert.equal(parsed.normalizedUrl, `https://www.douyin.com/note/${NOTE_ID}`);
});

/* ------------------------------------------------------------------ */
/* 4 & 5 & 6. modal_id URLs -> normalized video objects                */
/* ------------------------------------------------------------------ */

test('extractVideoId: jingxuan modal_id (documented failure case)', () => {
    const input = `https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`;
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: VIDEO_ID,
        type: 'video',
        normalizedUrl: `https://www.douyin.com/video/${VIDEO_ID}`,
    });
});

test('extractVideoId: exact reported URL jingxuan modal_id=7666774315384372859', () => {
    const input = 'https://www.douyin.com/jingxuan?modal_id=7666774315384372859';
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: '7666774315384372859',
        type: 'video',
        normalizedUrl: 'https://www.douyin.com/video/7666774315384372859',
    });
});

test('extractVideoId: discover modal_id', () => {
    const input = `https://www.douyin.com/discover?modal_id=${VIDEO_ID}`;
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: VIDEO_ID,
        type: 'video',
        normalizedUrl: `https://www.douyin.com/video/${VIDEO_ID}`,
    });
});

test('extractVideoId: user page modal_id', () => {
    const input = `https://www.douyin.com/user/${USER_UID}?modal_id=${VIDEO_ID}`;
    const result = extractVideoId(input);
    assert.deepEqual(result, {
        id: VIDEO_ID,
        type: 'video',
        normalizedUrl: `https://www.douyin.com/video/${VIDEO_ID}`,
    });
});

test('modal_id takes priority over the path (video/user/discover pages)', () => {
    const cases = [
        `https://www.douyin.com/video/1111111111111111111?modal_id=${VIDEO_ID}`,
        `https://www.douyin.com/user/${USER_UID}?modal_id=${VIDEO_ID}`,
        `https://www.douyin.com/discover?modal_id=${VIDEO_ID}&source=discover`,
        `https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`,
    ];
    for (const input of cases) {
        const result = extractVideoId(input);
        assert.equal(result?.type, 'video', input);
        assert.equal(result?.id, VIDEO_ID, input);
        assert.equal(result?.normalizedUrl, `https://www.douyin.com/video/${VIDEO_ID}`, input);
    }
});

test('extractModalId returns the id when present and numeric', () => {
    assert.equal(extractModalId(`https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`), VIDEO_ID);
    assert.equal(extractModalId(`https://www.douyin.com/user/${USER_UID}?modal_id=${VIDEO_ID}`), VIDEO_ID);
    assert.equal(extractModalId('https://www.douyin.com/video/1234567890123456789'), null);
    assert.equal(extractModalId('https://www.douyin.com/discover?modal_id=abc'), null);
    assert.equal(extractModalId('https://www.douyin.com/discover'), null);
});

/* ------------------------------------------------------------------ */
/* Convenience helpers                                                 */
/* ------------------------------------------------------------------ */

test('extractSecUid returns the sec_uid for user pages', () => {
    assert.equal(extractSecUid(`https://www.douyin.com/user/${USER_UID}`), USER_UID);
    // A user page carrying a modal_id represents the video opened in the modal,
    // so the parser (and extractSecUid) treats it as a video, not a user page.
    assert.equal(extractSecUid(`https://www.douyin.com/user/${USER_UID}?modal_id=${VIDEO_ID}`), null);
    assert.equal(extractSecUid('https://www.douyin.com/video/123'), null);
});

test('normalizeDouyinUrl strips query string and fragment but keeps the path', () => {
    assert.equal(
        normalizeDouyinUrl(`https://www.douyin.com/video/${VIDEO_ID}?modal_id=1#top`),
        `https://www.douyin.com/video/${VIDEO_ID}`,
    );
    assert.equal(normalizeDouyinUrl(`https://v.douyin.com/${SHORT_CODE}?x=1#h`), `https://v.douyin.com/${SHORT_CODE}`);
});

/* ------------------------------------------------------------------ */
/* Null / non-video cases                                              */
/* ------------------------------------------------------------------ */

test('extractVideoId returns null for non-video URLs', () => {
    assert.equal(extractVideoId(`https://www.douyin.com/user/${USER_UID}`), null);
    assert.equal(extractVideoId('https://example.com/video/123'), null);
    assert.equal(extractVideoId('https://example.com/'), null);
    assert.equal(extractVideoId(''), null);
    assert.equal(extractVideoId('   '), null);
    assert.equal(extractVideoId('not a url at all'), null);
    assert.equal(extractVideoId('https://www.douyin.com/'), null);
});

/* ------------------------------------------------------------------ */
/* Unknown / invalid inputs                                            */
/* ------------------------------------------------------------------ */

test('non-douyin URLs resolve to type "unknown" without throwing', () => {
    const input = 'https://example.com/video/123';
    const parsed = parseDouyinUrl(input);
    assert.equal(parsed.type, 'unknown');
    assert.equal(parsed.id, null);
    assert.equal(parsed.normalizedUrl, input);
    assert.equal(parsed.originalUrl, input);
});

test('recognized douyin host with an unmatched path is "unknown"', () => {
    const parsed = parseDouyinUrl('https://www.douyin.com/');
    assert.equal(parsed.type, 'unknown');
    assert.equal(parsed.id, null);
});

test('invalid input throws DouyinUrlParseError', () => {
    assert.throws(() => parseDouyinUrl(''), DouyinUrlParseError);
    assert.throws(() => parseDouyinUrl('   '), DouyinUrlParseError);
    assert.throws(() => parseDouyinUrl('not a url at all'), DouyinUrlParseError);
    assert.throws(() => parseDouyinUrl(undefined as unknown as string), DouyinUrlParseError);
});

/* ------------------------------------------------------------------ */
/* Contract checks                                                     */
/* ------------------------------------------------------------------ */

test('parsed output always matches the { type, id, originalUrl, normalizedUrl } contract', () => {
    const samples: string[] = [
        `https://v.douyin.com/${SHORT_CODE}`,
        `https://www.douyin.com/video/${VIDEO_ID}`,
        `https://www.douyin.com/user/${USER_UID}`,
        `https://www.douyin.com/note/${NOTE_ID}`,
        `https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`,
        `https://www.douyin.com/discover?modal_id=${VIDEO_ID}`,
    ];
    for (const input of samples) {
        const parsed: ParsedDouyinUrl = parseDouyinUrl(input);
        assert.equal(typeof parsed.type, 'string', input);
        assert.equal(typeof parsed.id, 'string', input);
        assert.equal(typeof parsed.originalUrl, 'string', input);
        assert.equal(typeof parsed.normalizedUrl, 'string', input);
        assert.ok(parsed.normalizedUrl.length > 0, input);
    }
});

test('extractVideoId always returns the { id, type, normalizedUrl } contract', () => {
    const samples: string[] = [
        `https://v.douyin.com/${SHORT_CODE}`,
        `https://www.douyin.com/video/${VIDEO_ID}`,
        `https://www.douyin.com/note/${NOTE_ID}`,
        `https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`,
        `https://www.douyin.com/discover?modal_id=${VIDEO_ID}`,
        `https://www.douyin.com/user/${USER_UID}?modal_id=${VIDEO_ID}`,
    ];
    for (const input of samples) {
        const result: VideoParseResult | null = extractVideoId(input);
        assert.ok(result, input);
        assert.equal(typeof result.id, 'string', input);
        assert.ok(result.type === 'video' || result.type === 'note', input);
        assert.equal(typeof result.normalizedUrl, 'string', input);
        assert.ok(result.normalizedUrl.length > 0, input);
    }
});
