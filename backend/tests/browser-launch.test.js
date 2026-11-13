import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveKernelExecutable, listKernels } from '../kernel-manager.js';

import {
    STEALTH_IGNORE_DEFAULT_ARGS,
    resolveIgnoreDefaultArgs,
    buildBrowserLaunchOptions,
    usesPatchright,
    resolveBrowserEngine
} from '../browser-launch.js';

const parseProxy = (str) => (str ? { server: `http://${str}`, username: 'u', password: 'p' } : null);

test('resolveIgnoreDefaultArgs: unset / "1" / "true" → default list', () => {
    assert.deepEqual(resolveIgnoreDefaultArgs(undefined), [...STEALTH_IGNORE_DEFAULT_ARGS]);
    assert.deepEqual(resolveIgnoreDefaultArgs('1'), [...STEALTH_IGNORE_DEFAULT_ARGS]);
    assert.deepEqual(resolveIgnoreDefaultArgs('true'), [...STEALTH_IGNORE_DEFAULT_ARGS]);
});

test('resolveIgnoreDefaultArgs: "0" / "false" / "off" → disabled', () => {
    assert.deepEqual(resolveIgnoreDefaultArgs('0'), []);
    assert.deepEqual(resolveIgnoreDefaultArgs('false'), []);
    assert.deepEqual(resolveIgnoreDefaultArgs('OFF'), []);
});

test('resolveIgnoreDefaultArgs: custom comma list, ignores non-flag junk', () => {
    assert.deepEqual(
        resolveIgnoreDefaultArgs(' --disable-sync, --metrics-recording-only ,junk,'),
        ['--disable-sync', '--metrics-recording-only']
    );
});

test('default list never includes flags that were deliberately kept', () => {
    for (const kept of [
        '--use-mock-keychain', '--password-store=basic', '--disable-hang-monitor',
        '--disable-prompt-on-repost', '--disable-search-engine-choice-screen', '--no-sandbox'
    ]) {
        assert.ok(!STEALTH_IGNORE_DEFAULT_ARGS.includes(kept), `${kept} must not be ignored`);
    }
});

test('buildBrowserLaunchOptions: base shape, sandbox on, ignore list applied', () => {
    delete process.env.STEALTH_IGNORE_DEFAULT_ARGS;
    const opts = buildBrowserLaunchOptions(null, {});
    assert.equal(opts.headless, false);
    assert.equal(opts.chromiumSandbox, true);
    assert.deepEqual(opts.args, ['--disable-blink-features=AutomationControlled']);
    assert.deepEqual(opts.ignoreDefaultArgs, [...STEALTH_IGNORE_DEFAULT_ARGS]);
    assert.equal(opts.proxy, undefined);
    assert.equal(opts.viewport, undefined);
});

test('buildBrowserLaunchOptions: env "0" omits ignoreDefaultArgs entirely', () => {
    process.env.STEALTH_IGNORE_DEFAULT_ARGS = '0';
    try {
        const opts = buildBrowserLaunchOptions(null, {});
        assert.ok(!('ignoreDefaultArgs' in opts));
    } finally {
        delete process.env.STEALTH_IGNORE_DEFAULT_ARGS;
    }
});

test('buildBrowserLaunchOptions: proxy applied and logged when enabled', () => {
    const lines = [];
    const opts = buildBrowserLaunchOptions(
        { proxy: '1.2.3.4:8080', use_proxy: 1 },
        { parseProxy, log: (m) => lines.push(m) }
    );
    assert.deepEqual(opts.proxy, { server: 'http://1.2.3.4:8080', username: 'u', password: 'p' });
    assert.deepEqual(lines, ['Using proxy: http://1.2.3.4:8080 (with auth)']);
});

test('buildBrowserLaunchOptions: use_proxy === 0 or missing proxy → no proxy', () => {
    assert.equal(buildBrowserLaunchOptions({ proxy: '1.2.3.4:8080', use_proxy: 0 }, { parseProxy }).proxy, undefined);
    assert.equal(buildBrowserLaunchOptions({ proxy: '', use_proxy: 1 }, { parseProxy }).proxy, undefined);
});

test('buildBrowserLaunchOptions: extraArgs and viewport pass through', () => {
    const opts = buildBrowserLaunchOptions(null, {
        extraArgs: ['--window-size=1440,900'],
        viewport: { width: 1440, height: 900 }
    });
    assert.deepEqual(opts.args, ['--disable-blink-features=AutomationControlled', '--window-size=1440,900']);
    assert.deepEqual(opts.viewport, { width: 1440, height: 900 });
});

test('usesPatchright: only an explicit 1 turns it on', () => {
    assert.equal(usesPatchright({ use_patchright: 1 }), true);
    assert.equal(usesPatchright({ use_patchright: 0 }), false);
    assert.equal(usesPatchright({}), false);
    assert.equal(usesPatchright(null), false);
});

test('resolveBrowserEngine: patchright runs on installed Chrome', () => {
    const base = { headless: false };
    assert.deepEqual(resolveBrowserEngine({ use_patchright: 1 }, base), {
        engine: 'patchright',
        options: { headless: false, channel: 'chrome' }
    });
    assert.equal(base.channel, undefined);
});

test('resolveBrowserEngine: valid kernel_path → kernel engine with executablePath, no channel', () => {
    const resolveKernel = (p) => (p === 'k157' ? 'D:/kernels/k157/chrome.exe' : null);
    const { engine, options } = resolveBrowserEngine(
        { kernel_path: 'k157', use_patchright: 0 }, { headless: false }, resolveKernel
    );
    assert.equal(engine, 'kernel');
    assert.equal(options.executablePath, 'D:/kernels/k157/chrome.exe');
    assert.equal(options.channel, undefined);
});

test('resolveBrowserEngine: missing kernel falls back to the profile default engine', () => {
    const none = () => null;
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.equal(resolveBrowserEngine({ kernel_path: 'gone', use_patchright: 0 }, {}, none).engine, 'playwright');
        assert.equal(resolveBrowserEngine({ kernel_path: 'gone', use_patchright: 1 }, {}, none).engine, 'patchright');
    } finally {
        console.warn = warn;
    }
});

test('resolveBrowserEngine: blank kernel_path is ignored', () => {
    let called = false;
    const spy = () => { called = true; return 'x'; };
    assert.equal(resolveBrowserEngine({ kernel_path: '  ' }, {}, spy).engine, 'playwright');
    assert.equal(called, false);
});

test('resolveKernelExecutable: folder name, absolute folder, direct exe, missing', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kernels-'));
    try {
        const dir = path.join(base, 'chromium-157');
        fs.mkdirSync(dir);
        const exe = path.join(dir, process.platform === 'win32' ? 'chrome.exe' : 'chrome');
        fs.writeFileSync(exe, '');
        assert.equal(resolveKernelExecutable('chromium-157', base), exe);
        assert.equal(resolveKernelExecutable(dir, base), exe);
        assert.equal(resolveKernelExecutable(exe, base), exe);
        assert.equal(resolveKernelExecutable('nope', base), null);
        assert.equal(resolveKernelExecutable('', base), null);
        assert.equal(resolveKernelExecutable(null, base), null);
        assert.deepEqual(listKernels(base), [{ name: 'chromium-157', executable: exe }]);
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('resolveBrowserEngine: playwright keeps bundled Chromium', () => {
    const { engine, options } = resolveBrowserEngine({ use_patchright: 0 }, { headless: false });
    assert.equal(engine, 'playwright');
    assert.equal(options.channel, undefined);
});
