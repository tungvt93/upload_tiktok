// Human-paced waits and typing for the TikTok automation flows.
//
// Constant delays (`waitForTimeout(3000)`, `type(text, { delay: 30 })`) make
// every run identical to the millisecond, which is one of the behavioural
// signals TikTok scores a device on. These helpers keep the author's intended
// pacing but spread it the way a person would.

/** Integer in [min, max], inclusive. `random` is injectable for tests. */
export function randomBetween(min, max, random = Math.random) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(random() * (hi - lo + 1));
}

/**
 * A wait of roughly `baseMs`, drawn uniformly from 0.8x..1.3x of it.
 * The band is deliberately narrow (mean ~1.05x) so a full upload run takes
 * about as long as before; the point is irregular timing, not slowness.
 */
export function jitterMs(baseMs, { min = 0.8, max = 1.3, random = Math.random } = {}) {
    const base = Math.max(0, Number(baseMs) || 0);
    if (base === 0) return 0;
    return Math.max(1, Math.round(base * (min + random() * (max - min))));
}

/**
 * Per-character delays for `text`: 50..130ms per key, with a `pauseChance`
 * probability of a 200..400ms hesitation (thinking, glancing at the screen).
 */
export function humanTypingDelays(text, { random = Math.random, pauseChance = 0.05 } = {}) {
    const delays = [];
    for (let i = 0; i < text.length; i++) {
        if (random() < pauseChance) delays.push(randomBetween(200, 400, random));
        else delays.push(randomBetween(50, 130, random));
    }
    return delays;
}

/**
 * Type `text` into whatever currently has focus, one character at a time with
 * human-like gaps. Replaces `keyboard.type(text, { delay: N })`, whose constant
 * `delay` produces perfectly regular keystroke timing.
 */
export async function typeLikeHuman(page, text, opts = {}) {
    if (typeof text !== 'string' || text.length === 0) return;
    const delays = humanTypingDelays(text, opts);
    for (let i = 0; i < text.length; i++) {
        await page.keyboard.type(text[i]);
        await page.waitForTimeout(delays[i]);
    }
}
