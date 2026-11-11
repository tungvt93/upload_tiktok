import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FINGERPRINT_GENERATOR_OPTIONS,
    createFingerprintGenerator,
    isInjectableFingerprint,
    parseStoredFingerprint
} from '../fingerprint.js';

test('generator options: Windows desktop Chrome with Vietnamese-friendly locales', () => {
    assert.deepEqual(FINGERPRINT_GENERATOR_OPTIONS.operatingSystems, ['windows']);
    assert.deepEqual(FINGERPRINT_GENERATOR_OPTIONS.devices, ['desktop']);
    assert.ok(FINGERPRINT_GENERATOR_OPTIONS.locales.includes('vi-VN'));
});

test('createFingerprintGenerator produces an injectable fingerprint with matching headers', () => {
    const fp = createFingerprintGenerator().getFingerprint();
    assert.ok(isInjectableFingerprint(fp));
    assert.match(fp.fingerprint.navigator.userAgent, /Windows NT/);
    assert.equal(fp.headers['user-agent'], fp.fingerprint.navigator.userAgent);
    assert.match(fp.headers['accept-language'], /vi-VN|en-US/);
    const { width, height } = fp.fingerprint.screen;
    assert.ok(width >= 1280 && width <= 1920, `screen width ${width} within 1280..1920`);
    assert.ok(height >= 720 && height <= 1080, `screen height ${height} within 720..1080`);
});

test('isInjectableFingerprint rejects legacy bare fingerprints and junk', () => {
    assert.equal(isInjectableFingerprint(null), false);
    assert.equal(isInjectableFingerprint({}), false);
    // Old rows stored the bare fingerprint without the headers block.
    assert.equal(isInjectableFingerprint({ navigator: { userAgent: 'x' }, screen: { width: 1, height: 1 } }), false);
    assert.equal(isInjectableFingerprint({ fingerprint: { navigator: {}, screen: {} }, headers: {} }), false);
});

test('parseStoredFingerprint returns the object for a valid row, null otherwise', () => {
    const fp = createFingerprintGenerator().getFingerprint();
    assert.deepEqual(parseStoredFingerprint(JSON.stringify(fp)), fp);
    assert.equal(parseStoredFingerprint(null), null);
    assert.equal(parseStoredFingerprint(''), null);
    assert.equal(parseStoredFingerprint('{not json'), null);
    assert.equal(parseStoredFingerprint(JSON.stringify({ navigator: { userAgent: 'x' } })), null);
});
