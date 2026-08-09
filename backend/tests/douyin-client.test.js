/**
 * douyin-client.test.js — offline unit tests for the Douyin client URL handling.
 *
 * Covers the fix where `?modal_id=` URLs (jingxuan/discover) must resolve to
 * the canonical https://www.douyin.com/video/{id} page WITHOUT any network
 * round-trip, so the video id is always extractable afterwards.
 *
 * All cases below hit `resolveShortUrl`'s fast path (canonical video/note
 * URLs), so they never touch the network.
 *
 * Usage: node --test tests/douyin-client.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveShortUrl, extractVideoId } from '../douyin-client.js';

const VIDEO_ID = '7666774315384372859';

test('resolveShortUrl: jingxuan modal_id resolves to canonical video URL (no network)', async () => {
    const resolved = await resolveShortUrl(`https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`);
    assert.equal(resolved, `https://www.douyin.com/video/${VIDEO_ID}`);
});

test('resolveShortUrl: discover modal_id resolves to canonical video URL (no network)', async () => {
    const resolved = await resolveShortUrl(`https://www.douyin.com/discover?modal_id=${VIDEO_ID}`);
    assert.equal(resolved, `https://www.douyin.com/video/${VIDEO_ID}`);
});

test('resolveShortUrl: direct /video/{id} is unchanged (no network)', async () => {
    const resolved = await resolveShortUrl(`https://www.douyin.com/video/${VIDEO_ID}`);
    assert.equal(resolved, `https://www.douyin.com/video/${VIDEO_ID}`);
});

test('resolveShortUrl: /note/{id} stays a note URL (no network)', async () => {
    const noteId = '1234567890123456789';
    const resolved = await resolveShortUrl(`https://www.douyin.com/note/${noteId}`);
    assert.equal(resolved, `https://www.douyin.com/note/${noteId}`);
});

test('resolveShortUrl: rejects an empty URL', async () => {
    await assert.rejects(() => resolveShortUrl(''), /URL is required/);
    await assert.rejects(() => resolveShortUrl('   '), /URL is required/);
});

test('extractVideoId: the exact reported modal_id URL yields the video id', () => {
    const result = extractVideoId(`https://www.douyin.com/jingxuan?modal_id=${VIDEO_ID}`);
    assert.ok(result, 'expected a non-null result');
    assert.equal(result.id, VIDEO_ID);
    assert.equal(result.type, 'video');
    assert.equal(result.normalizedUrl, `https://www.douyin.com/video/${VIDEO_ID}`);
});
