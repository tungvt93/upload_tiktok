# TikTok Video Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Thống kê" button to the Profiles dashboard that opens selected profiles in Playwright, crawls TikTok Studio for video stats and restriction flags, then lets the user download an Excel report.

**Architecture:** SSE-based streaming — `POST /api/stats/start` launches a background job running 2 profiles in parallel via Playwright. Each profile pushes SSE events to a `GET /api/stats/stream/:jobId` endpoint. Frontend StatsModal subscribes to the stream, shows realtime progress, and enables `GET /api/stats/download/:jobId` when done. Results live in a memory Map (auto-cleared after 30 min).

**Tech Stack:** Express SSE, Playwright (existing), ExcelJS (new), React state in useProfiles hook.

## Global Constraints

- Backend is ES modules (`"type": "module"`) — all new `.js` backend files use `export`/`import`; `.mjs` extension also works
- Profile browser data dir: `path.join(PROFILES_DIR, profile.name)` where `PROFILES_DIR = path.join(__dirname, '..', 'profiles')`
- Browser launch pattern: `chromium.launchPersistentContext(userDataDir, { headless: false, args: ['--disable-blink-features=AutomationControlled'] })`
- Frontend state lives in `useProfiles.js`; App.jsx spreads `{...ui}` to `<ProfilesView>`
- No TypeScript — plain JS/JSX only
- Concurrency: exactly 2 profiles run simultaneously; extras queue in batches of 2

---

### Task 1: Install exceljs

**Files:**
- Modify: `backend/package.json` (npm install adds it)

**Interfaces:**
- Produces: `import ExcelJS from 'exceljs'` available in backend

- [ ] **Step 1: Install exceljs**

```bash
cd /Users/its/Documents/Codes/upload_tiktok/backend && npm install exceljs
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module <<'EOF'
import ExcelJS from 'exceljs';
console.log('OK', ExcelJS.version ?? 'loaded');
EOF
```

Expected: prints `OK` (with or without version string).

- [ ] **Step 3: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add backend/package.json backend/package-lock.json
git commit -m "chore: add exceljs for stats Excel export"
```

---

### Task 2: Create backend/stats-store.js — in-memory job store

**Files:**
- Create: `backend/stats-store.js`

**Interfaces:**
- Produces (all named exports):
  - `createJob(profileIds: string[]): string` — returns jobId (UUID)
  - `getJob(jobId: string): Job | undefined`
  - `addClient(jobId: string, res): void`
  - `removeClient(jobId: string, res): void`
  - `pushEvent(jobId: string, event: object): void` — broadcast SSE to all connected clients
  - `appendResult(jobId: string, profileId: string, video: VideoResult): void`
  - `markProfileDone(jobId: string, profileId: string): void`
  - `markAllDone(jobId: string): void`
  - `markError(jobId: string, profileId: string, message: string): void`
  - `cancelJob(jobId: string): void`
  - `isAborted(jobId: string): boolean`
  - `getExcelBuffer(jobId: string, profileNames: Map<string,string>): Promise<Buffer>`
  - Job shape: `{ status: 'running'|'done'|'cancelled', profileIds: string[], results: Map<profileId, VideoResult[]>, clients: Set<res>, aborted: boolean }`
  - VideoResult shape: `{ title: string, date: string, views: number, restricted: boolean }`

- [ ] **Step 1: Create the file**

```js
// backend/stats-store.js
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

const jobs = new Map();
const AUTO_CLEANUP_MS = 30 * 60 * 1000;

export function createJob(profileIds) {
  const jobId = randomUUID();
  setTimeout(() => jobs.delete(jobId), AUTO_CLEANUP_MS);
  jobs.set(jobId, {
    status: 'running',
    profileIds: [...profileIds],
    results: new Map(),
    clients: new Set(),
    aborted: false,
  });
  return jobId;
}

export function getJob(jobId) {
  return jobs.get(jobId);
}

export function addClient(jobId, res) {
  jobs.get(jobId)?.clients.add(res);
}

export function removeClient(jobId, res) {
  jobs.get(jobId)?.clients.delete(res);
}

export function pushEvent(jobId, event) {
  const job = jobs.get(jobId);
  if (!job) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of job.clients) {
    try { client.write(data); } catch (_) {}
  }
}

export function appendResult(jobId, profileId, video) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (!job.results.has(profileId)) job.results.set(profileId, []);
  job.results.get(profileId).push(video);
}

export function markProfileDone(jobId, profileId) {
  pushEvent(jobId, { type: 'done', profileId });
}

export function markAllDone(jobId) {
  const job = jobs.get(jobId);
  if (job) job.status = 'done';
  pushEvent(jobId, { type: 'all_done' });
}

export function markError(jobId, profileId, message) {
  pushEvent(jobId, { type: 'error', profileId, message });
}

export function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.aborted = true;
  job.status = 'cancelled';
}

export function isAborted(jobId) {
  return jobs.get(jobId)?.aborted ?? true;
}

export async function getExcelBuffer(jobId, profileNames) {
  const job = jobs.get(jobId);
  if (!job) throw new Error('Job not found');

  const workbook = new ExcelJS.Workbook();

  for (const [profileId, videos] of job.results) {
    const rawName = profileNames.get(profileId) || profileId;
    const sheetName = rawName.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: 'STT',        key: 'stt',        width: 6  },
      { header: 'Ngày upload', key: 'date',       width: 16 },
      { header: 'Views',       key: 'views',      width: 12 },
      { header: 'Restricted',  key: 'restricted', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    videos.forEach((v, i) => {
      const row = sheet.addRow({
        stt: i + 1,
        date: v.date,
        views: v.views,
        restricted: v.restricted ? 'RED' : '',
      });
      if (v.restricted) {
        const cell = row.getCell('restricted');
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        cell.font  = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
    });
  }

  return workbook.xlsx.writeBuffer();
}
```

- [ ] **Step 2: Smoke-test the store**

```bash
cd /Users/its/Documents/Codes/upload_tiktok/backend
node --input-type=module <<'EOF'
import { createJob, appendResult, getJob } from './stats-store.js';
const jid = createJob(['p1']);
appendResult(jid, 'p1', { title: 'test', date: '1/1/2026', views: 10, restricted: false });
const job = getJob(jid);
console.assert(job.results.get('p1').length === 1, 'result stored');
console.log('stats-store OK');
EOF
```

Expected: `stats-store OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add backend/stats-store.js
git commit -m "feat: add stats in-memory job store with Excel export"
```

---

### Task 3: Create backend/stats-automation.mjs — Playwright crawl

**Files:**
- Create: `backend/stats-automation.mjs`

**Interfaces:**
- Consumes: `chromium` from `playwright`; helper functions passed as `ctx` param
- Produces:
  - `runStatsForProfile(profile: {id,name,proxy}, jobId: string, ctx: Ctx): Promise<void>`
  - `Ctx` shape: `{ PROFILES_DIR: string, pushEvent, appendResult, markProfileDone, markError, isAborted }` — all functions from stats-store.js

- [ ] **Step 1: Create the file**

```js
// backend/stats-automation.mjs
import { chromium } from 'playwright';
import path from 'path';

const CONTENT_URL = 'https://www.tiktok.com/tiktokstudio/content';
const RESTRICTION_TEXT = 'Your video is not eligible for recommendation in the For You feed';

export async function runStatsForProfile(profile, jobId, ctx) {
  const { PROFILES_DIR, pushEvent, appendResult, markProfileDone, markError, isAborted } = ctx;
  const userDataDir = path.join(PROFILES_DIR, profile.name);
  let browser = null;

  const log = (msg) => console.log(`[${profile.name}][STATS] ${msg}`);

  try {
    const browserOptions = {
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    };
    if (profile.proxy) {
      const proxyParts = profile.proxy.match(/^(?:(.*):(.*)@)?(.+):(\d+)$/);
      if (proxyParts) {
        browserOptions.proxy = {
          server: `http://${proxyParts[3]}:${proxyParts[4]}`,
          ...(proxyParts[1] ? { username: proxyParts[1], password: proxyParts[2] } : {}),
        };
      }
    }

    browser = await chromium.launchPersistentContext(userDataDir, browserOptions);
    const page = await browser.newPage();

    log('Opening TikTok Studio content page');
    await page.goto(CONTENT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Phase 1: scrape video list (date + views) with infinite scroll
    log('Scraping video list...');
    const videos = await scrapeVideoList(page, log);
    log(`Found ${videos.length} videos`);

    pushEvent(jobId, {
      type: 'progress',
      profileId: profile.id,
      profileName: profile.name,
      done: 0,
      total: videos.length,
    });

    if (videos.length === 0) {
      markProfileDone(jobId, profile.id);
      return;
    }

    // Phase 2: open analytics for first video, then navigate via left panel
    log('Opening analytics for first video');
    const firstChartIcon = page.locator('[data-icon="ChartRise"]').first();
    await firstChartIcon.waitFor({ timeout: 10000 });
    await firstChartIcon.click();
    await page.waitForTimeout(3000);

    // Collect left-panel items once (they persist across navigation)
    // The left panel in analytics shows all video thumbnails as a scrollable list
    const panelSelector = 'aside [class*="css-"], [class*="VideoList"] [class*="css-"][style*="cursor"]';

    for (let i = 0; i < videos.length; i++) {
      if (isAborted(jobId)) break;

      await page.waitForTimeout(1500);

      const restricted = await checkRestriction(page);
      log(`Video ${i + 1}/${videos.length}: restricted=${restricted}`);

      const result = {
        title: videos[i].title,
        date: videos[i].date,
        views: videos[i].views,
        restricted,
      };

      appendResult(jobId, profile.id, result);
      pushEvent(jobId, { type: 'video', profileId: profile.id, ...result });
      pushEvent(jobId, {
        type: 'progress',
        profileId: profile.id,
        profileName: profile.name,
        done: i + 1,
        total: videos.length,
      });

      // Navigate to next video in left panel
      if (i < videos.length - 1 && !isAborted(jobId)) {
        await navigateToNextVideo(page, i, log);
        await page.waitForTimeout(2000);
      }
    }

    markProfileDone(jobId, profile.id);
  } catch (err) {
    log(`Error: ${err.message}`);
    markError(jobId, profile.id, err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeVideoList(page, log) {
  const videos = [];

  // Scroll to load all videos (TikTok Studio lazy-loads rows)
  let prevCount = 0;
  for (let attempt = 0; attempt < 25; attempt++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const rows = await page.locator('table tbody tr').count();
    if (rows === prevCount && attempt > 3) break;
    prevCount = rows;
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  // Scrape rows from the content table
  const rows = await page.locator('table tbody tr').all();
  for (const row of rows) {
    try {
      const cells = await row.locator('td').all();
      if (cells.length < 3) continue;

      // Cell 0: title/thumbnail, Cell 1: date published, Cell 2: views
      const titleText = await cells[0].innerText().catch(() => '');
      const dateText  = await cells[1].innerText().catch(() => '');
      const viewsText = await cells[2].innerText().catch(() => '0');
      const views = parseInt(viewsText.replace(/[^0-9]/g, '')) || 0;

      videos.push({
        title: titleText.trim().split('\n')[0] || 'Untitled',
        date: dateText.trim(),
        views,
      });
    } catch (_) {}
  }

  return videos;
}

async function checkRestriction(page) {
  try {
    // Check for the restriction banner text
    const el = page.locator(`text="${RESTRICTION_TEXT}"`).first();
    await el.waitFor({ state: 'visible', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function navigateToNextVideo(page, currentIndex, log) {
  // Strategy 1: click the (currentIndex+1)-th item in the analytics left panel
  // The left panel lists video thumbnails; each is a clickable div/img
  try {
    // Try multiple selectors for the left panel video list items
    const selectors = [
      // Generic: all img thumbnails in the sidebar/aside area
      'aside img',
      '[class*="panel"] img[src*="tiktok"]',
      // Fallback: any clickable div near video thumbnails
      '[class*="VideoListItem"]',
    ];

    for (const sel of selectors) {
      const items = await page.locator(sel).all();
      if (items.length > currentIndex + 1) {
        await items[currentIndex + 1].click({ timeout: 3000 });
        log(`Navigated via "${sel}" to index ${currentIndex + 1}`);
        return;
      }
    }

    log(`Warning: could not find left panel item at index ${currentIndex + 1}`);
  } catch (err) {
    log(`Navigation error: ${err.message}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add backend/stats-automation.mjs
git commit -m "feat: add TikTok Studio stats Playwright automation"
```

---

### Task 4: Add /api/stats/* routes to server.js

**Files:**
- Modify: `backend/server.js` — add 2 import lines at top, add 4 routes before `app.listen` (line 6592)

**Interfaces:**
- Consumes all exports from `stats-store.js` and `runStatsForProfile` from `stats-automation.mjs`
- Produces: `POST /api/stats/start`, `GET /api/stats/stream/:jobId`, `GET /api/stats/download/:jobId`, `DELETE /api/stats/cancel/:jobId`

- [ ] **Step 1: Add imports at the top of server.js**

After the existing `import { createProfileRecord } from './profile-store.js';` line (around line 28), add:

```js
import {
  createJob, getJob, addClient, removeClient,
  pushEvent, appendResult, markProfileDone, markError,
  markAllDone, cancelJob, isAborted, getExcelBuffer,
} from './stats-store.js';
import { runStatsForProfile } from './stats-automation.mjs';
```

- [ ] **Step 2: Add 4 routes before app.listen (line 6591)**

Insert this block immediately before the `setInterval(checkAndRunSchedules, 60000)` line at the end of the file:

```js
// ─── STATS FEATURE ───────────────────────────────────────────────────────────

// POST /api/stats/start
app.post('/api/stats/start', async (req, res) => {
  const { profileIds } = req.body;
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    return res.status(400).json({ error: 'profileIds required' });
  }

  const profiles = profileIds
    .map(id => db.prepare('SELECT * FROM profiles WHERE id = ?').get(id))
    .filter(Boolean);

  if (profiles.length === 0) {
    return res.status(400).json({ error: 'No valid profiles found' });
  }

  const jobId = createJob(profileIds);
  res.json({ jobId });

  // Run in background — 2 profiles at a time
  (async () => {
    const BATCH = 2;
    const ctx = { PROFILES_DIR, pushEvent, appendResult, markProfileDone, markError, isAborted };
    for (let i = 0; i < profiles.length; i += BATCH) {
      if (isAborted(jobId)) break;
      const batch = profiles.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(profile => runStatsForProfile(profile, jobId, ctx))
      );
    }
    markAllDone(jobId);
  })().catch(err => console.error('[Stats] runAll error:', err));
});

// GET /api/stats/stream/:jobId — SSE
app.get('/api/stats/stream/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (job.status === 'done' || job.status === 'cancelled') {
    res.write(`data: ${JSON.stringify({ type: 'all_done' })}\n\n`);
    res.end();
    return;
  }

  addClient(jobId, res);
  req.on('close', () => removeClient(jobId, res));
});

// GET /api/stats/download/:jobId
app.get('/api/stats/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  try {
    const profileNames = new Map();
    for (const pid of job.profileIds) {
      const p = db.prepare('SELECT name FROM profiles WHERE id = ?').get(pid);
      if (p) profileNames.set(pid, p.name);
    }
    const buffer = await getExcelBuffer(jobId, profileNames);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="tiktok_stats_${date}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stats/cancel/:jobId
app.delete('/api/stats/cancel/:jobId', (req, res) => {
  cancelJob(req.params.jobId);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Restart server and test start endpoint**

```bash
cd /Users/its/Documents/Codes/upload_tiktok/backend && node server.js &
sleep 2
curl -s -X POST http://localhost:3010/api/stats/start \
  -H 'Content-Type: application/json' \
  -d '{"profileIds":["nonexistent-id"]}' | python3 -m json.tool
```

Expected: `{"error": "No valid profiles found"}`

Kill test server: `pkill -f "node server.js"`

- [ ] **Step 4: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add backend/server.js
git commit -m "feat: add /api/stats/* routes for video statistics"
```

---

### Task 5: Create frontend/src/components/StatsModal.jsx

**Files:**
- Create: `frontend/src/components/StatsModal.jsx`

**Interfaces:**
- Consumes: `{ isOpen: boolean, profileIds: string[], onClose: () => void }`
- Produces: self-contained React modal; on mount starts job, subscribes SSE, shows progress; download button active when `all_done` received

- [ ] **Step 1: Create the component**

```jsx
// frontend/src/components/StatsModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Download, StopCircle, BarChart2 } from 'lucide-react';

export default function StatsModal({ isOpen, profileIds, onClose }) {
  const [jobId, setJobId]       = useState(null);
  const [logs, setLogs]         = useState([]);
  const [progress, setProgress] = useState({});  // profileId -> { done, total, name }
  const [isDone, setIsDone]     = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError]       = useState(null);
  const esRef   = useRef(null);
  const logsEnd = useRef(null);

  // Auto-scroll log
  useEffect(() => {
    logsEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Start job when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLogs([]);
    setProgress({});
    setIsDone(false);
    setJobId(null);
    setError(null);

    let cancelled = false;
    (async () => {
      setIsStarting(true);
      try {
        const res = await fetch('/api/stats/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start job');
        if (cancelled) return;
        setJobId(data.jobId);
        openStream(data.jobId);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen]);

  // Close EventSource on unmount
  useEffect(() => () => esRef.current?.close(), []);

  function openStream(jid) {
    const es = new EventSource(`/api/stats/stream/${jid}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'progress') {
        setProgress(prev => ({
          ...prev,
          [ev.profileId]: { done: ev.done, total: ev.total, name: ev.profileName },
        }));
      } else if (ev.type === 'video') {
        setLogs(prev => [...prev, { ...ev, isError: false }]);
      } else if (ev.type === 'error') {
        setLogs(prev => [...prev, { isError: true, message: ev.message, profileId: ev.profileId }]);
      } else if (ev.type === 'all_done') {
        setIsDone(true);
        es.close();
      }
    };

    es.onerror = () => {
      setError('Mất kết nối SSE');
      es.close();
    };
  }

  const handleClose = async () => {
    esRef.current?.close();
    if (jobId && !isDone) {
      await fetch(`/api/stats/cancel/${jobId}`, { method: 'DELETE' }).catch(() => {});
    }
    onClose();
  };

  const handleDownload = () => {
    const date = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = `/api/stats/download/${jobId}`;
    a.download = `tiktok_stats_${date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  const profileList = Object.entries(progress);
  const logCount = logs.filter(l => !l.isError).length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal"
        style={{ maxWidth: '640px', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.1rem' }}>
            <BarChart2 size={20} />
            Thống kê video TikTok
          </h2>
          <button className="btn btn-sm btn-card" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 16px 8px' }}>
          {isStarting && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang khởi động job...</p>
          )}
          {error && (
            <p style={{ color: 'var(--danger, #ef4444)', fontSize: '0.9rem' }}>Lỗi: {error}</p>
          )}

          {/* Progress bars per profile */}
          {profileList.map(([pid, p]) => (
            <div key={pid} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{p.done} / {p.total} video</span>
              </div>
              <div style={{ background: 'var(--surface, #eee)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--primary, #6366f1)',
                  height: '100%',
                  width: p.total > 0 ? `${Math.round((p.done / p.total) * 100)}%` : '0%',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ))}

          {/* Log panel */}
          <div style={{
            marginTop: '10px',
            maxHeight: '260px',
            overflowY: 'auto',
            background: 'var(--surface, #f5f5f5)',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '0.78rem',
            fontFamily: 'monospace',
          }}>
            {logs.length === 0 && !isStarting && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                Đang chờ dữ liệu...
              </p>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                style={{
                  padding: '2px 0',
                  borderBottom: '1px solid var(--border, #ddd)',
                  color: log.isError
                    ? 'var(--danger, #ef4444)'
                    : log.restricted
                      ? '#ef4444'
                      : 'var(--text)',
                }}
              >
                {log.isError
                  ? `[ERROR] ${log.message}`
                  : `${log.date} | ${log.views} views${log.restricted ? ' | 🚫 RESTRICTED' : ''}`
                }
              </div>
            ))}
            <div ref={logsEnd} />
          </div>

          {isDone && (
            <p style={{
              marginTop: '12px',
              color: 'var(--success, #22c55e)',
              fontWeight: 600,
              textAlign: 'center',
              fontSize: '0.9rem',
            }}>
              Hoàn thành! {logCount} video đã thống kê.
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px' }}>
          <button className="btn btn-secondary" onClick={handleClose}>
            <StopCircle size={14} />
            {isDone ? 'Đóng' : 'Hủy'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={!isDone || !jobId}
          >
            <Download size={14} />
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add frontend/src/components/StatsModal.jsx
git commit -m "feat: add StatsModal with SSE progress and Excel download"
```

---

### Task 6: Wire stats state into useProfiles.js and App.jsx

**Files:**
- Modify: `frontend/src/hooks/useProfiles.js` — add 2 state vars + 2 handlers + 4 return fields
- Modify: `frontend/src/App.jsx` — import StatsModal, mount it

**Interfaces:**
- Produces: `isStatsModalOpen`, `statsProfileIds`, `openStatsModal`, `closeStatsModal` in the `ui` object

- [ ] **Step 1: Add state to useProfiles.js**

After line 53 (`const [exportResults, setExportResults] = useState(null);`) add:
```js
const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
const [statsProfileIds,  setStatsProfileIds]  = useState([]);
```

After the `stopBulkEngage` function (around line 647), add:
```js
const openStatsModal = () => {
  if (selectedForRun.size === 0) {
    setMessage({ type: 'error', text: 'Chọn ít nhất một profile để thống kê.' });
    setTimeout(() => setMessage(null), 3000);
    return;
  }
  setStatsProfileIds([...selectedForRun]);
  setIsStatsModalOpen(true);
};

const closeStatsModal = () => setIsStatsModalOpen(false);
```

In the return object of `useProfiles`, add these 4 fields (near `startBulkEngage, stopBulkEngage`):
```js
isStatsModalOpen,
statsProfileIds,
openStatsModal,
closeStatsModal,
```

- [ ] **Step 2: Mount StatsModal in App.jsx**

Add import after the existing component imports (around line 10):
```jsx
import StatsModal from './components/StatsModal';
```

Add the modal just before `</div>` closing `app-container` (after the `<FolderSelectOverlay>` line):
```jsx
<StatsModal
  isOpen={ui.isStatsModalOpen}
  profileIds={ui.statsProfileIds}
  onClose={ui.closeStatsModal}
/>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add frontend/src/hooks/useProfiles.js frontend/src/App.jsx
git commit -m "feat: wire stats modal state into useProfiles and App"
```

---

### Task 7: Replace Engage bulk button with Thống kê button in ProfilesView.jsx

**Files:**
- Modify: `frontend/src/components/ProfilesView.jsx`

**Interfaces:**
- Consumes: `openStatsModal` from props (arrives via `{...ui}` spread)

- [ ] **Step 1: Swap Heart for BarChart2 in lucide imports**

In `ProfilesView.jsx` lines 1–14, replace:
```jsx
import {
  Plus,
  Play,
  RefreshCw,
  Layout,
  StopCircle,
  Heart,
  Upload,
  FolderOpen,
  Download,
  Trash2,
  LogIn
} from 'lucide-react';
```
with:
```jsx
import {
  Plus,
  Play,
  RefreshCw,
  Layout,
  StopCircle,
  Upload,
  FolderOpen,
  Download,
  Trash2,
  LogIn,
  BarChart2,
} from 'lucide-react';
```

- [ ] **Step 2: Add openStatsModal to the props list**

In the `ProfilesView` function signature destructuring, add `openStatsModal` after `startBulkLogin`.

- [ ] **Step 3: Remove the two engage-related computed variables**

Delete these two lines from the top of the component body (lines ~143–145):
```jsx
const selectedEngaging = [...selectedForRun].filter((id) => engagingProfiles.has(id));
const allSelectedEngaging = selectedForRun.size > 0 && selectedEngaging.length === selectedForRun.size;
```

- [ ] **Step 4: Replace the Bulk Engage button block**

Find the `{/* Bulk Engage button */}` block (~lines 294–305):
```jsx
{/* Bulk Engage button */}
<button
  className={`btn ${allSelectedEngaging ? 'btn-pink-danger' : 'btn-pink'}`}
  onClick={() => (allSelectedEngaging ? stopBulkEngage() : startBulkEngage())}
  disabled={!hasSelection}
  title={hasSelection ? (allSelectedEngaging ? 'Dừng Engage tất cả đã chọn' : 'Bật Auto Engage cho tất cả đã chọn') : 'Tick checkbox trên từng profile cần Engage'}
>
  {allSelectedEngaging
    ? <><StopCircle size={18} className="animate-pulse" /> Stop Engage</>
    : <><Heart size={18} /> Engage đã chọn</>
  }
</button>
```

Replace with:
```jsx
{/* Stats button */}
<button
  className="btn btn-primary"
  onClick={openStatsModal}
  disabled={!hasSelection}
  title={hasSelection ? 'Thống kê video cho các profile đã chọn' : 'Tick checkbox trên từng profile cần thống kê'}
>
  <BarChart2 size={18} />
  Thống kê
</button>
```

- [ ] **Step 5: Commit**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
git add frontend/src/components/ProfilesView.jsx
git commit -m "feat: replace bulk Engage button with Thống kê stats button"
```

---

## Self-Review Notes

- **Spec coverage:** All spec requirements mapped: toolbar button ✓, SSE streaming ✓, 2-parallel concurrency ✓, per-profile progress ✓, restriction detection ✓, Excel with red cells ✓, per-profile sheets ✓, 3 columns (date/views/restricted) ✓, cancel ✓, download ✓.
- **Left-panel navigation (Task 3):** Selectors are best-effort since we cannot inspect the live DOM at plan time. `navigateToNextVideo` tries 3 selector strategies. The implementer should open a real TikTok Studio analytics page and inspect the left-panel element to confirm/tune the selector before finalizing.
- **Type consistency:** `VideoResult` shape defined in Task 2 and consumed identically in Tasks 3, 4, 5.
- **Proxy parsing in Task 3:** Uses a simple regex instead of calling `parseProxy` from server.js (avoids import cycle). Handles `user:pass@host:port` and bare `host:port` formats.
