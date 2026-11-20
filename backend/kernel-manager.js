// Locates custom Chromium "kernels" (self-built / patched Chromium folders).
//
// A kernel is a folder that contains chrome.exe, e.g.
//   <repo>/kernels/chromium-157.0.8103.38/chrome.exe
// A profile references one through profiles.kernel_path, which may be:
//   - a folder name under <repo>/kernels  ("chromium-157.0.8103.38")
//   - an absolute folder path             ("D:\\browsers\\chromium-157")
//   - a direct path to the executable     ("D:\\browsers\\chromium-157\\chrome.exe")

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const KERNELS_DIR = path.join(__dirname, '..', 'kernels');
// GPM Login keeps its Chromium cores here and they are offered as kernels too, so a
// profile can run on the exact GPM core. Two layouts exist:
//   GPMLogin        ...\Programs\GPMLogin\gpm_browser\gpm_browser_chromium_core_142\chrome.exe
//   GPMLoginGlobal  ...\Programs\GPMLoginGlobal\Browser\ChromiumCore_v142\chrome.exe
// GPM_BROWSER_DIR (the folder that holds the core folders) overrides the defaults.
const PROGRAMS_DIR = path.join(process.env.LOCALAPPDATA || '', 'Programs');
export const GPM_CORES_DIRS = process.env.GPM_BROWSER_DIR
    ? [process.env.GPM_BROWSER_DIR]
    : [path.join(PROGRAMS_DIR, 'GPMLogin', 'gpm_browser'), path.join(PROGRAMS_DIR, 'GPMLoginGlobal', 'Browser')];
export const GPM_CORES_DIR = GPM_CORES_DIRS[0];
const GPM_CORE_RE = /^(?:gpm_browser_chromium_core_|ChromiumCore_v)(\d+)$/i;
// Only the default kernels dir also searches the GPM install; a custom baseDir (tests) stays isolated.
const defaultExtra = (baseDir) => (baseDir === KERNELS_DIR ? GPM_CORES_DIRS : []);
const EXE_NAME = process.platform === 'win32' ? 'chrome.exe' : 'chrome';

function isFile(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}
function isDir(p) {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

/**
 * Resolve a profile's kernel_path to an existing chrome executable.
 * Returns null when unset or when nothing is there (caller decides the fallback).
 */
export function resolveKernelExecutable(kernelPath, baseDir = KERNELS_DIR, extraDirs = defaultExtra(baseDir)) {
    const raw = typeof kernelPath === 'string' ? kernelPath.trim() : '';
    if (!raw) return null;

    const candidates = path.isAbsolute(raw) ? [raw] : [path.join(baseDir, raw)];
    // A GPM core is matched by major version, so a profile saved as
    // "gpm_browser_chromium_core_142" also finds "ChromiumCore_v142" (GPMLoginGlobal) and back.
    const core = path.isAbsolute(raw) ? null : GPM_CORE_RE.exec(raw);
    if (core) {
        for (const d of extraDirs) {
            candidates.push(path.join(d, raw));
            if (!isDir(d)) continue;
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const m = e.isDirectory() && GPM_CORE_RE.exec(e.name);
                if (m && m[1] === core[1]) candidates.push(path.join(d, e.name));
            }
        }
    }
    for (const target of candidates) {
        if (isFile(target)) return target;
        if (isDir(target)) {
            const exe = path.join(target, EXE_NAME);
            if (isFile(exe)) return exe;
        }
    }
    return null;
}

/**
 * Version of a kernel, read from the "<version>.manifest" file Chrome ships next
 * to chrome.exe (e.g. "157.0.8103.38.manifest"). Returns null when absent.
 */
export function readKernelVersion(executablePath) {
    if (!executablePath) return null;
    try {
        const dir = path.dirname(executablePath);
        const entries = fs.readdirSync(dir);
        for (const name of entries) {
            const m = /^(\d+\.\d+\.\d+\.\d+)\.manifest$/i.exec(name);
            if (m) return m[1];
        }
        // GPM cores keep the binaries in a "<version>/" subfolder next to chrome.exe.
        for (const name of entries) {
            const m = /^(\d+\.\d+\.\d+\.\d+)$/.exec(name);
            if (m && isDir(path.join(dir, name))) return m[1];
        }
    } catch { /* unreadable dir */ }
    return null;
}

/** Kernel folders available under baseDir (those that contain chrome.exe). */
export function listKernels(baseDir = KERNELS_DIR, extraDirs = defaultExtra(baseDir)) {
    const scan = (dir, only) => {
        if (!isDir(dir)) return [];
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && (!only || only.test(d.name)) && isFile(path.join(dir, d.name, EXE_NAME)))
            .map((d) => ({ name: d.name, executable: path.join(dir, d.name, EXE_NAME) }));
    };
    const own = scan(baseDir);
    const names = new Set(own.map((k) => k.name));
    const gpm = extraDirs.flatMap((d) => scan(d, GPM_CORE_RE)).filter((k) => !names.has(k.name));
    return [...own, ...gpm];
}
