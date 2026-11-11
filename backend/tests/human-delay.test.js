import test from 'node:test';
import assert from 'node:assert/strict';

import { jitterMs, randomBetween, humanTypingDelays, typeLikeHuman } from '../human-delay.js';

const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };

test('jitterMs stays within 0.8x..1.3x of the base and is an integer', () => {
    assert.equal(jitterMs(1000, { random: () => 0 }), 800);
    assert.equal(jitterMs(1000, { random: () => 0.999999 }), 1300);
    for (let i = 0; i < 200; i++) {
        const v = jitterMs(3000);
        assert.ok(Number.isInteger(v) && v >= 2400 && v <= 3900, `got ${v}`);
    }
});

test('jitterMs never returns less than 1ms for tiny bases', () => {
    assert.ok(jitterMs(0) >= 0);
    assert.ok(jitterMs(1, { random: () => 0 }) >= 1);
});

test('randomBetween is inclusive on both ends', () => {
    assert.equal(randomBetween(5, 10, () => 0), 5);
    assert.equal(randomBetween(5, 10, () => 0.999999), 10);
});

test('humanTypingDelays: one delay per character, in the human band, with occasional long pauses', () => {
    const text = 'hello world';
    const delays = humanTypingDelays(text, { random: () => 0.5 });
    assert.equal(delays.length, text.length);
    for (const d of delays) assert.ok(d >= 50 && d <= 130, `plain delay ${d}`);

    // random() < pauseChance on the first draw → a long pause for that character
    const paused = humanTypingDelays('ab', { random: seq(0.01, 0.5, 0.5, 0.5) });
    assert.ok(paused[0] >= 200 && paused[0] <= 400, `pause ${paused[0]}`);
    assert.ok(paused[1] >= 50 && paused[1] <= 130, `plain ${paused[1]}`);
});

test('typeLikeHuman types one character at a time and waits between them', async () => {
    const typed = [];
    const waits = [];
    const page = {
        keyboard: { type: async (s) => { typed.push(s); } },
        waitForTimeout: async (ms) => { waits.push(ms); }
    };
    await typeLikeHuman(page, 'abc', { random: () => 0.5 });
    assert.deepEqual(typed, ['a', 'b', 'c']);
    assert.equal(waits.length, 3);
    for (const w of waits) assert.ok(w >= 50 && w <= 130);
});

test('typeLikeHuman is a no-op for empty or non-string input', async () => {
    const page = { keyboard: { type: async () => { throw new Error('should not type'); } }, waitForTimeout: async () => {} };
    await typeLikeHuman(page, '');
    await typeLikeHuman(page, null);
});
