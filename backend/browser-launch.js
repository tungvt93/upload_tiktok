// Shared Chrome launch options for every launchPersistentContext() call.
//
// Playwright silently appends ~30 command-line switches to every Chrome launch
// (see node_modules/playwright-core/lib/server/chromium/chromiumSwitches.js).
// A handful of them change browser behaviour in ways a real, hand-opened Chrome
// never has. We strip those via `ignoreDefaultArgs`, but only the ones that are
// safe to drop — the rest are kept on purpose because removing them can surface
// native dialogs that block automation.

// Dropped: a real user's Chrome never runs with these.
export const STEALTH_IGNORE_DEFAULT_ARGS = Object.freeze([
    '--disable-back-forward-cache',              // changes navigation caching; observable via pageshow.persisted
    '--metrics-recording-only',                  // non-default metrics config
    '--disable-client-side-phishing-detection',  // real Chrome always has this on
    '--disable-ipc-flooding-protection',         // allows bot-like burst input
    '--force-color-profile=srgb',                // overrides the real monitor profile (canvas/colour fingerprint)
    '--disable-sync'                             // real Chrome leaves this at default
]);
// `--no-sandbox` is also dropped, but via `chromiumSandbox: true` (the official
// option) instead of the ignore list.

// Kept on purpose — dropping these risks a native popup blocking automation:
//   --use-mock-keychain / --password-store=basic  → macOS keychain prompt on every launch
//   --disable-hang-monitor                        → "page unresponsive" dialog when a proxy stalls
//   --disable-prompt-on-repost                    → "confirm form resubmission" on reload()/goBack()
//   --disable-search-engine-choice-screen         → EU search-engine chooser on first load

import { chromium as playwrightChromium } from 'playwright';

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no']);

/**
 * Resolve the ignore list from the STEALTH_IGNORE_DEFAULT_ARGS env var:
 *   unset / "1" / "true"  → default list above
 *   "0" / "false" / "off" → disabled (Playwright defaults, i.e. old behaviour)
 *   "--flag-a,--flag-b"   → custom list (lets a single flag be pulled without a redeploy)
 */
export function resolveIgnoreDefaultArgs(envValue = process.env.STEALTH_IGNORE_DEFAULT_ARGS) {
    const raw = (envValue ?? '').trim();
    if (raw === '' || raw === '1' || raw.toLowerCase() === 'true') return [...STEALTH_IGNORE_DEFAULT_ARGS];
    if (DISABLED_VALUES.has(raw.toLowerCase())) return [];
    return raw.split(',').map(s => s.trim()).filter(s => s.startsWith('--'));
}

/**
 * Build the options object for chromium.launchPersistentContext().
 *
 * @param {object|null} profile   profile row (uses .proxy / .use_proxy); null = no proxy
 * @param {object}      opts
 * @param {Function}    opts.parseProxy  proxy string → Playwright proxy config
 * @param {Function}    [opts.log]       receives a "Using proxy: ..." line when a proxy is applied
 * @param {string[]}    [opts.extraArgs] additional Chrome args (e.g. --window-size)
 * @param {object}      [opts.viewport]  Playwright viewport option
 */
export function buildBrowserLaunchOptions(profile, { parseProxy, log, extraArgs = [], viewport } = {}) {
    const ignoreDefaultArgs = resolveIgnoreDefaultArgs();
    const options = {
        headless: false,
        // Keep Chrome's own sandbox on (Playwright adds --no-sandbox unless told otherwise).
        chromiumSandbox: true,
        args: ['--disable-blink-features=AutomationControlled', ...extraArgs]
    };
    if (ignoreDefaultArgs.length > 0) options.ignoreDefaultArgs = ignoreDefaultArgs;
    if (viewport) options.viewport = viewport;

    if (profile && profile.proxy && profile.use_proxy !== 0 && typeof parseProxy === 'function') {
        const proxyConfig = parseProxy(profile.proxy);
        if (proxyConfig) {
            options.proxy = proxyConfig;
            if (typeof log === 'function') {
                log(`Using proxy: ${proxyConfig.server}${proxyConfig.username ? ' (with auth)' : ''}`);
            }
        }
    }
    return options;
}

/** A profile runs on Patchright only when its use_patchright flag is explicitly on. */
export function usesPatchright(profile) {
    return Boolean(profile) && Number(profile.use_patchright) === 1;
}

/**
 * Pick the browser engine for a profile.
 * Patchright always runs on the installed Google Chrome (`channel: 'chrome'`);
 * Playwright keeps its bundled Chromium.
 */
export function resolveBrowserEngine(profile, options = {}) {
    if (usesPatchright(profile)) {
        return { engine: 'patchright', options: { ...options, channel: 'chrome' } };
    }
    return { engine: 'playwright', options };
}

/**
 * launchPersistentContext() on the engine selected for this profile.
 * Patchright is imported on first use so Playwright-only profiles never load it.
 */
export async function launchProfileBrowser(userDataDir, profile, browserOptions) {
    const { engine, options } = resolveBrowserEngine(profile, browserOptions);
    const chromium = engine === 'patchright'
        ? (await import('patchright')).chromium
        : playwrightChromium;
    return chromium.launchPersistentContext(userDataDir, options);
}
