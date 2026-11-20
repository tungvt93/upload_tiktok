// Fingerprint helpers for profiles running on a custom kernel.
//
// Works on the object produced by fingerprint-generator:
//   { fingerprint: { navigator, screen, videoCard, ... }, headers: { 'user-agent', 'sec-ch-ua', ... } }
// (a bare inner `fingerprint` object is accepted too).

const unwrap = (fp) => (fp && fp.fingerprint) ? fp.fingerprint : fp;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function chromeMajor(userAgent) {
    const m = /Chrome\/(\d+)/.exec(userAgent || '');
    return m ? Number(m[1]) : null;
}

function uaOs(userAgent = '') {
    if (/Windows NT/i.test(userAgent)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(userAgent)) return 'mac';
    if (/Android/i.test(userAgent)) return 'android';
    if (/Linux|X11/i.test(userAgent)) return 'linux';
    return null;
}

const PLATFORM_BY_OS = { windows: 'Win32', mac: 'MacIntel', linux: 'Linux x86_64' };

/**
 * Return a copy of the fingerprint whose Chrome version matches the kernel
 * (e.g. kernel 157.0.8103.38 → "Chrome/157.0.0.0", reduced-UA style).
 * No-op copy when kernelVersion is missing/invalid.
 */
export function alignToKernel(fp, kernelVersion) {
    const out = clone(fp);
    const major = Number(String(kernelVersion || '').split('.')[0]);
    if (!Number.isInteger(major) || major <= 0) return out;
    const full = /^\d+\.\d+\.\d+\.\d+$/.test(kernelVersion) ? kernelVersion : `${major}.0.0.0`;

    const swapUa = (s) => (typeof s === 'string' ? s.replace(/Chrome\/\d+(\.\d+){0,3}/g, `Chrome/${major}.0.0.0`) : s);
    const swapBrands = (s) => (typeof s === 'string'
        ? s.replace(/("(?:Google Chrome|Chromium)";v=")\d+(")/g, `$1${major}$2`)
        : s);

    const nav = unwrap(out)?.navigator;
    if (nav) {
        nav.userAgent = swapUa(nav.userAgent);
        nav.appVersion = swapUa(nav.appVersion);
        const uad = nav.userAgentData;
        if (uad) {
            for (const b of uad.brands || []) {
                if (/Chrome|Chromium/.test(b.brand)) b.version = String(major);
            }
            for (const b of uad.fullVersionList || []) {
                if (/Chrome|Chromium/.test(b.brand)) b.version = full;
            }
            if (uad.uaFullVersion) uad.uaFullVersion = full;
        }
    }
    if (out.headers) {
        for (const k of Object.keys(out.headers)) {
            if (k.toLowerCase() === 'user-agent') out.headers[k] = swapUa(out.headers[k]);
            if (k.toLowerCase() === 'sec-ch-ua') out.headers[k] = swapBrands(out.headers[k]);
        }
    }
    return out;
}

/**
 * Check a fingerprint for internal contradictions and mismatches with the
 * kernel / proxy geo. Returns { errors: string[], warnings: string[] }.
 * Errors are things a detector will flag; warnings are unusual-but-possible.
 *
 * @param {object} ctx
 * @param {string} [ctx.kernelVersion]  e.g. "157.0.8103.38"
 * @param {{languages?: string[]}} [ctx.geo]  expected locale from the proxy IP
 */
export function validateFingerprint(fp, ctx = {}) {
    const errors = [];
    const warnings = [];
    const f = unwrap(fp);
    const nav = f?.navigator;
    if (!nav || !nav.userAgent) {
        return { errors: ['fingerprint has no navigator.userAgent'], warnings };
    }

    const os = uaOs(nav.userAgent);
    const expectedPlatform = PLATFORM_BY_OS[os];
    if (expectedPlatform && nav.platform && nav.platform !== expectedPlatform) {
        errors.push(`navigator.platform "${nav.platform}" does not match UA OS (${os} → ${expectedPlatform})`);
    }

    const uaMajor = chromeMajor(nav.userAgent);
    const kMajor = Number(String(ctx.kernelVersion || '').split('.')[0]);
    if (kMajor && uaMajor && uaMajor !== kMajor) {
        errors.push(`UA claims Chrome ${uaMajor} but kernel is ${kMajor}`);
    }

    const renderer = f?.videoCard?.renderer || '';
    if (os === 'windows' && /Apple|Metal|Mesa/i.test(renderer)) {
        errors.push(`GPU "${renderer}" is not a Windows GPU`);
    } else if (os === 'windows' && renderer && !/Direct3D|D3D11/i.test(renderer)) {
        warnings.push(`Windows GPU renderer has no Direct3D marker: "${renderer}"`);
    }
    if (os === 'mac' && renderer && /Direct3D/i.test(renderer)) {
        errors.push(`GPU "${renderer}" is not a macOS GPU`);
    }

    const { width, height } = f?.screen || {};
    if (width && height && (width < 800 || height < 600 || width > 7680 || height > 4320)) {
        warnings.push(`unusual screen size ${width}x${height}`);
    }
    if (nav.hardwareConcurrency && (nav.hardwareConcurrency < 2 || nav.hardwareConcurrency > 64)) {
        warnings.push(`unusual hardwareConcurrency ${nav.hardwareConcurrency}`);
    }
    if (nav.deviceMemory && ![0.25, 0.5, 1, 2, 4, 8].includes(nav.deviceMemory)) {
        warnings.push(`deviceMemory ${nav.deviceMemory} is not a value Chrome reports`);
    }

    const expectedLangs = ctx.geo?.languages;
    if (Array.isArray(expectedLangs) && expectedLangs.length && nav.language) {
        const primary = (l) => String(l).toLowerCase().split('-')[0];
        if (!expectedLangs.some((l) => primary(l) === primary(nav.language))) {
            warnings.push(`navigator.language "${nav.language}" differs from proxy region languages (${expectedLangs.join(', ')})`);
        }
    }
    return { errors, warnings };
}

/**
 * Neutral, kernel-agnostic description of what a profile should look like.
 * A kernel adapter turns this into the flags / JSON file the specific build reads.
 */
export function toKernelConfig(fp, { geo } = {}) {
    const f = unwrap(fp) || {};
    const nav = f.navigator || {};
    return {
        userAgent: nav.userAgent,
        platform: nav.platform,
        languages: nav.languages || (nav.language ? [nav.language] : undefined),
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
        screen: f.screen ? { width: f.screen.width, height: f.screen.height, devicePixelRatio: f.screen.devicePixelRatio } : undefined,
        gpu: f.videoCard ? { vendor: f.videoCard.vendor, renderer: f.videoCard.renderer } : undefined,
        timezone: geo?.timezone,
        geolocation: geo?.geolocation
    };
}
