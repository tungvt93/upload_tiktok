import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { alignToKernel, validateFingerprint, toKernelConfig, chromeMajor } from '../fingerprint.js';
import { readKernelVersion } from '../kernel-manager.js';

const sample = () => ({
    fingerprint: {
        navigator: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            platform: 'Win32',
            language: 'en-US',
            languages: ['en-US', 'en'],
            hardwareConcurrency: 8,
            deviceMemory: 8,
            userAgentData: {
                brands: [{ brand: 'Chromium', version: '121' }, { brand: 'Not A;Brand', version: '99' }, { brand: 'Google Chrome', version: '121' }],
                fullVersionList: [{ brand: 'Chromium', version: '121.0.6167.85' }],
                uaFullVersion: '121.0.6167.85'
            }
        },
        screen: { width: 1920, height: 1080, devicePixelRatio: 1 },
        videoCard: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' }
    },
    headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="121", "Not A(Brand";v="99", "Google Chrome";v="121"'
    }
});

test('chromeMajor parses the UA', () => {
    assert.equal(chromeMajor('... Chrome/157.0.0.0 Safari/537.36'), 157);
    assert.equal(chromeMajor('Firefox/120'), null);
});

test('alignToKernel rewrites every Chrome version to the kernel version, without mutating input', () => {
    const fp = sample();
    const out = alignToKernel(fp, '157.0.8103.38');
    assert.equal(chromeMajor(out.fingerprint.navigator.userAgent), 157);
    assert.match(out.fingerprint.navigator.appVersion, /Chrome\/157\.0\.0\.0/);
    assert.match(out.headers['user-agent'], /Chrome\/157\.0\.0\.0/);
    assert.equal(out.headers['sec-ch-ua'], '"Chromium";v="157", "Not A(Brand";v="99", "Google Chrome";v="157"');
    const uad = out.fingerprint.navigator.userAgentData;
    assert.deepEqual(uad.brands.map((b) => b.version), ['157', '99', '157']);
    assert.equal(uad.fullVersionList[0].version, '157.0.8103.38');
    assert.equal(uad.uaFullVersion, '157.0.8103.38');
    assert.equal(chromeMajor(fp.fingerprint.navigator.userAgent), 121, 'input untouched');
});

test('alignToKernel with no/invalid version returns an unchanged copy', () => {
    const fp = sample();
    assert.deepEqual(alignToKernel(fp, null), fp);
    assert.deepEqual(alignToKernel(fp, 'abc'), fp);
});

test('validateFingerprint: consistent fingerprint passes', () => {
    const fp = alignToKernel(sample(), '157.0.8103.38');
    assert.deepEqual(validateFingerprint(fp, { kernelVersion: '157.0.8103.38', geo: { languages: ['en-US'] } }), { errors: [], warnings: [] });
});

test('validateFingerprint: flags UA/kernel version mismatch', () => {
    const { errors } = validateFingerprint(sample(), { kernelVersion: '157.0.8103.38' });
    assert.deepEqual(errors, ['UA claims Chrome 121 but kernel is 157']);
});

test('validateFingerprint: flags platform and GPU contradictions', () => {
    const fp = sample();
    fp.fingerprint.navigator.platform = 'MacIntel';
    fp.fingerprint.videoCard.renderer = 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
    const { errors } = validateFingerprint(fp);
    assert.equal(errors.length, 2);
    assert.match(errors[0], /platform/);
    assert.match(errors[1], /not a Windows GPU/);
});

test('validateFingerprint: warns on odd values and language/geo mismatch', () => {
    const fp = sample();
    fp.fingerprint.navigator.deviceMemory = 6;
    fp.fingerprint.navigator.hardwareConcurrency = 1;
    fp.fingerprint.screen = { width: 320, height: 200 };
    const { errors, warnings } = validateFingerprint(fp, { geo: { languages: ['vi-VN'] } });
    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 4);
});

test('validateFingerprint: missing UA is an error', () => {
    assert.deepEqual(validateFingerprint({}).errors, ['fingerprint has no navigator.userAgent']);
});

test('toKernelConfig: neutral shape, geo fields passed through', () => {
    const cfg = toKernelConfig(sample(), { geo: { timezone: 'Asia/Ho_Chi_Minh' } });
    assert.equal(cfg.platform, 'Win32');
    assert.deepEqual(cfg.screen, { width: 1920, height: 1080, devicePixelRatio: 1 });
    assert.equal(cfg.gpu.vendor, 'Google Inc. (NVIDIA)');
    assert.equal(cfg.timezone, 'Asia/Ho_Chi_Minh');
});

test('readKernelVersion reads the <version>.manifest file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kver-'));
    try {
        fs.writeFileSync(path.join(dir, '157.0.8103.38.manifest'), '');
        fs.writeFileSync(path.join(dir, 'chrome.exe'), '');
        assert.equal(readKernelVersion(path.join(dir, 'chrome.exe')), '157.0.8103.38');
        fs.rmSync(path.join(dir, '157.0.8103.38.manifest'));
        assert.equal(readKernelVersion(path.join(dir, 'chrome.exe')), null);
        assert.equal(readKernelVersion(null), null);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
