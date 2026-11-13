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
export function resolveKernelExecutable(kernelPath, baseDir = KERNELS_DIR) {
    const raw = typeof kernelPath === 'string' ? kernelPath.trim() : '';
    if (!raw) return null;

    const target = path.isAbsolute(raw) ? raw : path.join(baseDir, raw);
    if (isFile(target)) return target;
    if (isDir(target)) {
        const exe = path.join(target, EXE_NAME);
        if (isFile(exe)) return exe;
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
        for (const name of fs.readdirSync(dir)) {
            const m = /^(\d+\.\d+\.\d+\.\d+)\.manifest$/i.exec(name);
            if (m) return m[1];
        }
    } catch { /* unreadable dir */ }
    return null;
}

/** Kernel folders available under baseDir (those that contain chrome.exe). */
export function listKernels(baseDir = KERNELS_DIR) {
    if (!isDir(baseDir)) return [];
    return fs.readdirSync(baseDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && isFile(path.join(baseDir, d.name, EXE_NAME)))
        .map((d) => ({ name: d.name, executable: path.join(baseDir, d.name, EXE_NAME) }));
}
