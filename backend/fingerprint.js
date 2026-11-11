// Per-profile browser fingerprints for Playwright (bundled Chromium) profiles.
//
// Patchright profiles never get a fingerprint: they run on the installed Google
// Chrome and Patchright's guidance is to let the real browser speak for itself,
// because every JS override is a measurable difference from stock Chrome.
//
// Playwright profiles share the real hardware of the host, so without a
// fingerprint all ~40 profiles on one machine look like one device. We generate
// one fingerprint per profile once, store it in the DB, and inject it with
// `fingerprint-injector` (prototype-level patches, native-looking toString,
// UA kept in sync between JS and HTTP headers).

import { FingerprintGenerator } from 'fingerprint-generator';

// Production runs on Windows, accounts and proxies are Vietnamese.
// `locales` keeps Accept-Language / navigator.language in line with that.
export const FINGERPRINT_GENERATOR_OPTIONS = Object.freeze({
    browsers: [{ name: 'chrome', minVersion: 110 }],
    operatingSystems: ['windows'],
    devices: ['desktop'],
    locales: ['vi-VN', 'en-US'],
    // The viewport is set to the fingerprint's screen; keep it within a common
    // monitor so 40 headful windows on one 1080p machine don't exceed the display.
    screen: { minWidth: 1280, maxWidth: 1920, minHeight: 720, maxHeight: 1080 }
});

export function createFingerprintGenerator() {
    return new FingerprintGenerator({ ...FINGERPRINT_GENERATOR_OPTIONS });
}

/**
 * True when `data` is a `{ fingerprint, headers }` pair the injector can apply.
 * Rows written by older code stored the bare fingerprint (no headers) and are
 * rejected here so the caller regenerates them.
 */
export function isInjectableFingerprint(data) {
    if (!data || typeof data !== 'object') return false;
    const { fingerprint, headers } = data;
    if (!fingerprint || typeof fingerprint !== 'object') return false;
    if (!headers || typeof headers !== 'object') return false;
    const ua = fingerprint.navigator?.userAgent;
    const { width, height } = fingerprint.screen ?? {};
    return typeof ua === 'string' && ua.length > 0
        && Number.isFinite(width) && Number.isFinite(height);
}

/** Parse the `profiles.fingerprint` column; null when missing, malformed or legacy. */
export function parseStoredFingerprint(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    return isInjectableFingerprint(data) ? data : null;
}

/**
 * launchPersistentContext() options that must be set at context creation for
 * the injected fingerprint to be consistent (the injector can't change these
 * afterwards): UA and a viewport matching the fingerprint's screen.
 *
 * Deliberately no `locale`: Playwright's locale emulation overrides the
 * Accept-Language header the injector sets, leaving it out of step with the
 * injected navigator.languages. The injector owns language entirely.
 */
export function fingerprintLaunchOptions(data) {
    if (!isInjectableFingerprint(data)) return {};
    const { navigator, screen } = data.fingerprint;
    return {
        userAgent: navigator.userAgent,
        viewport: { width: screen.width, height: screen.height }
    };
}
