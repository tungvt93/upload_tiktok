// GPM-style fingerprint config for profiles that run on a GPM Chromium core.
//
// A GPM core (gpm_browser_chromium_core_NNN) is a Chromium patched at C++ level.
// It reads its fingerprint from <user-data-dir>/Default/GPMSoft/gpm_fg.dat, which is
// the base64 of `{ "gpm": { ... } }`. Verified: the core applies it without the GPM
// launcher (timezone, UA, canvas/audio noise, navigator, WebGL, screen, clientRect,
// WebGPU). Valid modes are "real" | "noise" | "fake" ("custom" is ignored).
//
// The file lives inside the profile folder, so a profile keeps the same noise seeds
// (= the same identity) across launches. We only generate it when it is missing.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, 'gpm-default-config.json');

export const GPM_CONFIG_RELATIVE = path.join('Default', 'GPMSoft', 'gpm_fg.dat');

/** A GPM core ships gpmdriver.exe next to chrome.exe; vanilla Chromium builds do not. */
export function isGpmKernel(executablePath) {
    if (!executablePath) return false;
    const dir = path.dirname(executablePath);
    return fs.existsSync(path.join(dir, 'gpmdriver.exe')) || /gpm_browser_chromium_core/i.test(dir);
}

// Common desktop values, weighted towards the most frequent ones.
const PROCESSOR_CHOICES = [4, 6, 8, 8, 8, 12, 12, 16];
const DEVICE_MEMORY_CHOICES = [4, 8, 8, 8];
// performance.memory.jsHeapSizeLimit Chrome reports for each deviceMemory.
const HEAP_LIMIT_BY_MEMORY = { 4: 2248146944, 8: 4294705152 };

const defaultRandom =() => crypto.randomInt(0, 2 ** 31) / 2 ** 31; // [0,1)

/**
 * Build a fresh config. `real` modes stay `real` (they use the host's true values);
 * per-profile noise seeds are randomised so profiles differ from each other.
 *
 * @param {object} [o]
 * @param {string} [o.name]           profile name (informational)
 * @param {string} [o.kernelVersion]  e.g. "142.0.7444.163" → UA / brand version
 * @param {string} [o.timezone]       IANA zone (from proxy geo); omitted → "" = system
 * @param {{latitude:number,longitude:number}} [o.geo]  fake geolocation
 * @param {string} [o.publicIP]       WebRTC public IP (proxy exit IP)
 * @param {object} [o.overrides]      deep-merged over the result (e.g. {navigator:{processorCount:8}})
 * @param {Function} [o.random]       injectable RNG for tests
 */
export function buildGpmConfig(o = {}) {
    const rnd = o.random || defaultRandom;
    const cfg = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8')).gpm;
    const version = /^\d+\.\d+\.\d+\.\d+$/.test(o.kernelVersion || '') ? o.kernelVersion : null;
    const major = version ? version.split('.')[0] : null;

    cfg.name = o.name || '';
    if (version) {
        cfg.brand.version = version;
        cfg.userAgent = cfg.userAgent.replace(/Chrome\/\d+(\.\d+){0,3}/, `Chrome/${major}.0.0.0`);
    }
    if (o.timezone) cfg.timezone = o.timezone;
    if (o.geo) cfg.geo_location = { ...cfg.geo_location, mode: 'fake', latitude: o.geo.latitude, longitude: o.geo.longitude };
    if (o.publicIP) cfg.webRTC.publicIP = o.publicIP;

    // Per-profile identity. Every item below was measured on core 142: it changes the
    // reading, differs between profiles and is stable across launches of one profile.
    cfg.audio.noise = (rnd() * 2 - 1) * 2;
    cfg.canvas.mode = 'noise'; // the token is ignored while canvas.mode is "real"
    cfg.canvas.noiseToken = Math.floor(rnd() * 1e9) + 1;

    // Hardware the profile reports. deviceMemory is capped at 8 by Chrome itself.
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    const memory = pick(DEVICE_MEMORY_CHOICES);
    cfg.navigator = {
        ...cfg.navigator,
        mode: 'noise',
        processorCount: pick(PROCESSOR_CHOICES),
        deviceMemory: memory,
        jsHeapSizeLimit: HEAP_LIMIT_BY_MEMORY[memory]
    };

    // WebGL image noise. webglMetaMode stays "real": the GPU name and limits must keep
    // matching the card that actually renders ("noise" there swaps in the template GPU).
    // The core ignores these noise fields while they are -1.
    const frac = () => 0.1 + rnd() * 0.8;
    cfg.webgl = {
        ...cfg.webgl,
        mode: 'noise',
        webglMetaMode: 'real',
        canvasNoise: frac(),
        clientRectNoise: frac(),
        uniform2fNoise: frac(),
        uniform1Noise: frac(),
        uniform2Noise: frac(),
        uniform3Noise: frac(),
        uniform4Noise: frac(),
        readPixelsIndex: 1 + Math.floor(rnd() * 30),
        readPixelsNoiseVal: 1 + Math.floor(rnd() * 5)
    };
    cfg.clientRect = { ...cfg.clientRect, mode: 'noise', noise: frac() };
    // Left "real" on purpose: font (noise mode had no measurable effect) and screen
    // (a fake size the real window can exceed is a contradiction, worse than a shared one).

    return o.overrides ? deepMerge(cfg, o.overrides) : cfg;
}

function deepMerge(target, src) {
    for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepMerge(target[k], v);
        else target[k] = v;
    }
    return target;
}

export const encodeGpmConfig = (cfg) => Buffer.from(JSON.stringify({ gpm: cfg })).toString('base64');

export function decodeGpmConfig(text) {
    const parsed = JSON.parse(Buffer.from(String(text).trim(), 'base64').toString('utf8'));
    return parsed.gpm;
}

export function readGpmConfig(userDataDir) {
    try {
        return decodeGpmConfig(fs.readFileSync(path.join(userDataDir, GPM_CONFIG_RELATIVE), 'utf8'));
    } catch {
        return null;
    }
}

export function writeGpmConfig(userDataDir, cfg) {
    const file = path.join(userDataDir, GPM_CONFIG_RELATIVE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodeGpmConfig(cfg));
    return file;
}

/**
 * Make sure the profile has a config the core can read.
 * Existing config is kept (stable identity) but its UA/brand version is re-aligned
 * if the kernel was upgraded. Returns { created, config }.
 */
export function ensureGpmConfig(userDataDir, buildOpts = {}) {
    const existing = readGpmConfig(userDataDir);
    if (!existing) {
        const config = buildGpmConfig(buildOpts);
        writeGpmConfig(userDataDir, config);
        return { created: true, config };
    }
    const v = buildOpts.kernelVersion;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v || '') && existing.brand?.version !== v) {
        existing.brand = { ...existing.brand, version: v };
        existing.userAgent = String(existing.userAgent).replace(/Chrome\/\d+(\.\d+){0,3}/, `Chrome/${v.split('.')[0]}.0.0.0`);
        writeGpmConfig(userDataDir, existing);
    }
    return { created: false, config: existing };
}

/**
 * Command-line switches the GPM launcher passes (observed on a running GPM profile):
 *   --lang=<code>  --gpm-disable-machine-id  --gpm-use-pref-tracking-config-before-v137
 * --lang comes from the profile's own Preferences (first selected language, language
 * part only, e.g. "vi-VN" → "vi"); a fresh profile falls back to en-US.
 */
export function gpmLaunchArgs(userDataDir) {
    let lang = 'en-US';
    try {
        const prefs = JSON.parse(fs.readFileSync(path.join(userDataDir, 'Default', 'Preferences'), 'utf8'));
        const first = String(prefs?.intl?.selected_languages || '').split(',')[0].trim();
        if (first) lang = first.split('-')[0];
    } catch { /* new profile — no Preferences yet */ }
    return [`--lang=${lang}`, '--gpm-disable-machine-id', '--gpm-use-pref-tracking-config-before-v137'];
}

/**
 * Make the config agree with the proxy exit location (timezone, fake geolocation,
 * WebRTC public IP). Returns true when something changed.
 */
export function applyProxyGeo(cfg, geo) {
    if (!cfg || !geo) return false;
    const snap = () => JSON.stringify([cfg.timezone, cfg.geo_location, cfg.webRTC]);
    const before = snap();
    cfg.timezone = geo.timezone;
    cfg.geo_location = { ...cfg.geo_location, mode: 'fake', latitude: geo.latitude, longitude: geo.longitude };
    // WebRTC "real" leaks the machine's own public IP past the proxy (verified); "fake" reports the proxy exit IP.
    cfg.webRTC = { ...cfg.webRTC, mode: 'fake', ...(geo.ip ? { publicIP: geo.ip } : {}) };
    return snap() !== before;
}

/** Internal-consistency checks. Returns { errors, warnings }. */
export function validateGpmConfig(cfg, { kernelVersion } = {}) {
    const errors = [];
    const warnings = [];
    if (!cfg) return { errors: ['no GPM config'], warnings };
    const major = (/Chrome\/(\d+)/.exec(cfg.userAgent || '') || [])[1];
    if (kernelVersion) {
        const km = kernelVersion.split('.')[0];
        if (major && major !== km) errors.push(`UA Chrome/${major} does not match kernel ${kernelVersion}`);
        if (cfg.brand?.version && cfg.brand.version.split('.')[0] !== km) errors.push(`brand.version ${cfg.brand.version} does not match kernel ${kernelVersion}`);
    }
    const okModes = new Set(['real', 'noise', 'fake']);
    for (const k of ['navigator', 'audio', 'canvas', 'webgl', 'webgpu', 'screen', 'font', 'clientRect', 'webRTC', 'geo_location']) {
        const m = cfg[k]?.mode;
        if (m !== undefined && !okModes.has(m)) errors.push(`${k}.mode "${m}" is invalid (the core ignores it)`);
    }
    if (cfg.geo_location?.mode === 'fake' && !cfg.timezone) warnings.push('fake geolocation without timezone — they should agree');
    if (cfg.webRTC?.mode === 'fake' && !cfg.webRTC.publicIP) warnings.push('fake WebRTC without publicIP');
    return { errors, warnings };
}
