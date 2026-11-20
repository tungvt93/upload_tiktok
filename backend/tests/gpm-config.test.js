import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildGpmConfig, encodeGpmConfig, decodeGpmConfig, ensureGpmConfig,
    readGpmConfig, validateGpmConfig, isGpmKernel, GPM_CONFIG_RELATIVE
} from '../gpm-config.js';
import { prepareGpmKernelProfile } from '../browser-launch.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gpmcfg-'));
const V = '142.0.7444.163';

test('buildGpmConfig aligns UA and brand to the kernel version', () => {
    const c = buildGpmConfig({ kernelVersion: '143.0.1.2' });
    assert.match(c.userAgent, /Chrome\/143\.0\.0\.0/);
    assert.equal(c.brand.version, '143.0.1.2');
});

test('buildGpmConfig randomises per-profile seeds, honours overrides', () => {
    const a = buildGpmConfig({ kernelVersion: V });
    const b = buildGpmConfig({ kernelVersion: V, overrides: { navigator: { processorCount: 6 } } });
    assert.notEqual(a.canvas.noiseToken, b.canvas.noiseToken);
    assert.equal(b.navigator.processorCount, 6);
    assert.equal(b.navigator.mode, a.navigator.mode);
});

test('encode/decode round-trips and matches the GPM file format', () => {
    const c = buildGpmConfig({ kernelVersion: V });
    const txt = encodeGpmConfig(c);
    assert.deepEqual(decodeGpmConfig(txt), c);
    assert.ok(JSON.parse(Buffer.from(txt, 'base64').toString()).gpm);
});

test('ensureGpmConfig creates once, then keeps the same identity', () => {
    const dir = tmp();
    const first = ensureGpmConfig(dir, { kernelVersion: V });
    assert.equal(first.created, true);
    assert.ok(fs.existsSync(path.join(dir, GPM_CONFIG_RELATIVE)));
    const second = ensureGpmConfig(dir, { kernelVersion: V });
    assert.equal(second.created, false);
    assert.equal(second.config.canvas.noiseToken, first.config.canvas.noiseToken);
});

test('ensureGpmConfig re-aligns version when the kernel is upgraded', () => {
    const dir = tmp();
    ensureGpmConfig(dir, { kernelVersion: V });
    ensureGpmConfig(dir, { kernelVersion: '145.0.1.1' });
    const c = readGpmConfig(dir);
    assert.equal(c.brand.version, '145.0.1.1');
    assert.match(c.userAgent, /Chrome\/145\./);
});

test('buildGpmConfig gives each new profile its own hardware and noise', () => {
    const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
    const a = buildGpmConfig({ kernelVersion: V, random: seq([0.05, 0.2, 0.9]) });
    const b = buildGpmConfig({ kernelVersion: V, random: seq([0.6, 0.95, 0.4]) });

    for (const c of [a, b]) {
        assert.equal(c.canvas.mode, 'noise', 'noiseToken is ignored in real mode');
        assert.equal(c.webgl.mode, 'noise');
        assert.equal(c.webgl.webglMetaMode, 'real', 'GPU name must stay the real card');
        assert.equal(c.clientRect.mode, 'noise');
        assert.equal(c.font.mode, 'real');
        assert.equal(c.screen.mode, 'real');
        assert.ok([4, 6, 8, 12, 16].includes(c.navigator.processorCount));
        assert.ok([4, 8].includes(c.navigator.deviceMemory), 'Chrome never reports more than 8');
        assert.equal(c.navigator.jsHeapSizeLimit, c.navigator.deviceMemory === 8 ? 4294705152 : 2248146944);
        for (const k of ['canvasNoise', 'clientRectNoise', 'uniform1Noise', 'uniform2Noise', 'uniform3Noise', 'uniform4Noise', 'uniform2fNoise']) {
            assert.ok(c.webgl[k] > 0 && c.webgl[k] < 1, `${k} must not stay -1 (the core ignores it)`);
        }
        assert.ok(Number.isInteger(c.webgl.readPixelsIndex) && c.webgl.readPixelsIndex >= 1);
        assert.ok(c.clientRect.noise > 0 && c.clientRect.noise < 1);
        assert.deepEqual(validateGpmConfig(c, { kernelVersion: V }).errors, []);
    }
    assert.notEqual(a.webgl.uniform1Noise, b.webgl.uniform1Noise);
    assert.notEqual(a.clientRect.noise, b.clientRect.noise);
});

test('validateGpmConfig flags version drift and invalid modes', () => {
    const c = buildGpmConfig({ kernelVersion: V });
    assert.deepEqual(validateGpmConfig(c, { kernelVersion: V }).errors, []);
    assert.ok(validateGpmConfig(c, { kernelVersion: '150.0.0.0' }).errors.length >= 1);
    c.navigator.mode = 'custom';
    assert.ok(validateGpmConfig(c).errors.some((e) => /navigator\.mode/.test(e)));
});

test('isGpmKernel detects gpmdriver.exe or the GPM folder name', () => {
    const dir = tmp();
    const exe = path.join(dir, 'chrome.exe');
    fs.writeFileSync(exe, '');
    assert.equal(isGpmKernel(exe), false);
    fs.writeFileSync(path.join(dir, 'gpmdriver.exe'), '');
    assert.equal(isGpmKernel(exe), true);
    assert.equal(isGpmKernel(null), false);
});

test('prepareGpmKernelProfile only acts on GPM kernels and never throws', async () => {
    const dir = tmp();
    assert.equal(await prepareGpmKernelProfile('playwright', {}, dir, { name: 'x' }), null);
    assert.equal(await prepareGpmKernelProfile('kernel', { executablePath: path.join(dir, 'chrome.exe') }, dir, { name: 'x' }), null);
    const kdir = tmp();
    fs.writeFileSync(path.join(kdir, 'chrome.exe'), '');
    fs.writeFileSync(path.join(kdir, 'gpmdriver.exe'), '');
    fs.writeFileSync(path.join(kdir, `${V}.manifest`), '');
    const profDir = tmp();
    const cfg = await prepareGpmKernelProfile('kernel', { executablePath: path.join(kdir, 'chrome.exe') }, profDir, { name: 'x' });
    assert.equal(cfg.brand.version, V);
    assert.ok(fs.existsSync(path.join(profDir, GPM_CONFIG_RELATIVE)));
});

test('readKernelVersion finds the version from a <version>/ subfolder (GPM layout)', async () => {
    const { readKernelVersion } = await import('../kernel-manager.js');
    const kdir = tmp();
    fs.writeFileSync(path.join(kdir, 'chrome.exe'), '');
    fs.mkdirSync(path.join(kdir, V));
    assert.equal(readKernelVersion(path.join(kdir, 'chrome.exe')), V);
});

test('prepareGpmKernelProfile aligns timezone/geo/WebRTC to the proxy and caches the lookup', async () => {
    const kdir = tmp();
    for (const f of ['chrome.exe', 'gpmdriver.exe', `${V}.manifest`]) fs.writeFileSync(path.join(kdir, f), '');
    const profDir = tmp();
    const geo = { ip: '8.8.4.4', timezone: 'America/Chicago', latitude: 41.8, longitude: -87.6, country: 'US' };
    let calls = 0;
    const deps = { fetch: async () => { calls++; return geo; } };
    const opts = { executablePath: path.join(kdir, 'chrome.exe'), proxy: { server: 'http://1.2.3.4:80', username: 'u', password: 'p' } };
    const cfg = await prepareGpmKernelProfile('kernel', opts, profDir, { name: 'x' }, deps);
    assert.equal(cfg.timezone, 'America/Chicago');
    assert.equal(cfg.geo_location.mode, 'fake');
    assert.equal(cfg.geo_location.latitude, 41.8);
    assert.equal(cfg.webRTC.publicIP, '8.8.4.4');
    assert.equal(cfg.webRTC.mode, 'fake', 'real WebRTC would leak the host IP past the proxy');
    assert.equal(readGpmConfig(profDir).timezone, 'America/Chicago');
    await prepareGpmKernelProfile('kernel', opts, profDir, { name: 'x' }, deps);
    assert.equal(calls, 1, 'second launch with same proxy uses the cache');
    await prepareGpmKernelProfile('kernel', { ...opts, proxy: { server: 'http://9.9.9.9:80' } }, profDir, { name: 'x' }, deps);
    assert.equal(calls, 2, 'a changed proxy triggers a new lookup');
});

test('prepareGpmKernelProfile keeps going when the geo lookup fails', async () => {
    const kdir = tmp();
    for (const f of ['chrome.exe', 'gpmdriver.exe', `${V}.manifest`]) fs.writeFileSync(path.join(kdir, f), '');
    const cfg = await prepareGpmKernelProfile('kernel',
        { executablePath: path.join(kdir, 'chrome.exe'), proxy: { server: 'http://1.2.3.4:80' } }, tmp(), { name: 'x' }, { fetch: async () => null });
    assert.equal(cfg.timezone, '');
});

test('GPM cores are listed and resolvable by folder name; custom baseDir stays isolated', async () => {
    const { listKernels, resolveKernelExecutable } = await import('../kernel-manager.js');
    const base = tmp();
    const gpm = tmp();
    const core = path.join(gpm, 'gpm_browser_chromium_core_142');
    fs.mkdirSync(core);
    fs.writeFileSync(path.join(core, 'chrome.exe'), '');
    fs.mkdirSync(path.join(gpm, 'gpm_browser_firefox_core_145'));
    assert.deepEqual(listKernels(base, [gpm]).map((k) => k.name), ['gpm_browser_chromium_core_142']);
    assert.equal(resolveKernelExecutable('gpm_browser_chromium_core_142', base, [gpm]), path.join(core, 'chrome.exe'));
    assert.equal(resolveKernelExecutable('gpm_browser_firefox_core_145', base, [gpm]), null);
    assert.deepEqual(listKernels(base), []);
});

test('gpmLaunchArgs derives --lang from Preferences, defaults to en-US', async () => {
    const { gpmLaunchArgs } = await import('../gpm-config.js');
    const dir = tmp();
    assert.equal(gpmLaunchArgs(dir)[0], '--lang=en-US');
    fs.mkdirSync(path.join(dir, 'Default'));
    fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), JSON.stringify({ intl: { selected_languages: 'vi-VN,vi,en-US' } }));
    const args = gpmLaunchArgs(dir);
    assert.equal(args[0], '--lang=vi');
    assert.ok(args.includes('--gpm-disable-machine-id'));
});

test('prepareGpmKernelProfile adds GPM args and a real (non-emulated) viewport', async () => {
    const kdir = tmp();
    for (const f of ['chrome.exe', 'gpmdriver.exe', `${V}.manifest`]) fs.writeFileSync(path.join(kdir, f), '');
    const opts = { executablePath: path.join(kdir, 'chrome.exe'), args: ['--x'] };
    await prepareGpmKernelProfile('kernel', opts, tmp(), { name: 'x' });
    assert.ok(opts.args.includes('--x') && opts.args.some((a) => a.startsWith('--lang=')));
    assert.equal(opts.viewport, null);
    const explicit = { executablePath: path.join(kdir, 'chrome.exe'), viewport: { width: 800, height: 600 } };
    await prepareGpmKernelProfile('kernel', explicit, tmp(), { name: 'x' });
    assert.deepEqual(explicit.viewport, { width: 800, height: 600 });
});

test('GPMLoginGlobal cores (ChromiumCore_v142) are listed and found by either name', async () => {
    const { listKernels, resolveKernelExecutable } = await import('../kernel-manager.js');
    const base = tmp();
    const gpm = tmp();
    const core = path.join(gpm, 'ChromiumCore_v142');
    fs.mkdirSync(core);
    fs.writeFileSync(path.join(core, 'chrome.exe'), '');
    assert.deepEqual(listKernels(base, [gpm]).map((k) => k.name), ['ChromiumCore_v142']);
    assert.equal(resolveKernelExecutable('ChromiumCore_v142', base, [gpm]), path.join(core, 'chrome.exe'));
    // a profile saved on a GPMLogin machine still resolves on a GPMLoginGlobal one
    assert.equal(resolveKernelExecutable('gpm_browser_chromium_core_142', base, [gpm]), path.join(core, 'chrome.exe'));
    assert.equal(resolveKernelExecutable('gpm_browser_chromium_core_143', base, [gpm]), null);
});
