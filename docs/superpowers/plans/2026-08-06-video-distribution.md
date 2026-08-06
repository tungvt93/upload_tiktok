# Video Distribution Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Phân Phối Video" tab with persistent profile selection and round-robin video distribution from a source folder to profile upload folders.

**Architecture:** Add 1 SQLite table, 4 API routes in the Express backend, and 1 new tab + 2 new modals in the React frontend. Follow existing monolith patterns (server.js routes, App.jsx tab rendering + inline modals with AnimatePresence).

**Tech Stack:** Express 5, better-sqlite3, React 18, Framer Motion, Axios, Lucide React icons

## Global Constraints

- Follow existing code patterns in `backend/server.js` and `frontend/src/App.jsx`
- Reuse existing CSS classes (`.glass`, `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.badge`)
- Follow existing modal pattern: `AnimatePresence` + `motion.div` overlay + `.glass` card
- Polling: 5-second interval via `setInterval` in `useEffect`, matching existing pattern
- All backend routes use try/catch with `res.status(err.status || 400).json({ error: err.message })`

---

### Task 1: Create distribution_profiles table in backend

**Files:**
- Modify: `backend/server.js` — add table creation after existing schema block

**Interfaces:**
- Produces: `distribution_profiles` table (id, profile_id UNIQUE, created_at) with FK to profiles ON DELETE CASCADE

- [ ] **Step 1: Add table creation to initial schema block**

In `backend/server.js`, locate the `db.exec(` block that creates tables (around line 78-99). Add the new table inside the same `db.exec()` call, right before the closing backtick of the SQL string.

Current SQL block ends with:
```sql
    CREATE TABLE IF NOT EXISTS profile_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT,
        time TEXT,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
`)
```

Add this table definition after `profile_schedules` and before the closing `);` of `db.exec()`:
```sql
    CREATE TABLE IF NOT EXISTS distribution_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
```

The closing backtick and `);` remain unchanged.

- [ ] **Step 2: Verify table exists after schema init**

The new table will be created on server restart inside the existing `CREATE TABLE IF NOT EXISTS` block. No separate migration is needed since we're adding to the initial schema.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add distribution_profiles table to schema"
```

---

### Task 2: Add GET /api/distribution/profiles endpoint

**Files:**
- Modify: `backend/server.js` — add route handler before `app.listen()` call

**Interfaces:**
- Consumes: `distribution_profiles` table (from Task 1)
- Produces: `GET /api/distribution/profiles` → `[{ id, profile_id, profile_name, group_name, video_folder, created_at }]`

- [ ] **Step 1: Add the route**

Find the last route before `app.listen(PORT, ...)` at the end of the file (or add before a group of related routes). Insert this new route:

```js
app.get('/api/distribution/profiles', (req, res) => {
    try {
        const profiles = db.prepare(`
            SELECT
                dp.id,
                dp.profile_id,
                p.name AS profile_name,
                g.name AS group_name,
                p.video_folder,
                dp.created_at
            FROM distribution_profiles dp
            JOIN profiles p ON p.id = dp.profile_id
            LEFT JOIN groups g ON g.id = p.group_id
            ORDER BY dp.created_at ASC
        `).all();
        res.json(profiles);
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Test the endpoint**

Start the server and curl the endpoint to verify it returns an empty array:

```bash
curl http://localhost:3010/api/distribution/profiles
# Expected: []
```

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add GET /api/distribution/profiles endpoint"
```

---

### Task 3: Add POST /api/distribution/profiles endpoint

**Files:**
- Modify: `backend/server.js` — add route after the GET route from Task 2

**Interfaces:**
- Consumes: `distribution_profiles` table (from Task 1)
- Produces: `POST /api/distribution/profiles` — body `{ profile_id: string }` → `{ id, profile_id, created_at }`

- [ ] **Step 1: Add the route**

Insert after the GET route added in Task 2:

```js
app.post('/api/distribution/profiles', (req, res) => {
    try {
        const { profile_id } = req.body;
        if (!profile_id) {
            return res.status(400).json({ error: 'profile_id is required' });
        }

        // Check profile exists
        const profile = db.prepare('SELECT id FROM profiles WHERE id = ?').get(profile_id);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check not already in distribution list
        const existing = db.prepare('SELECT id FROM distribution_profiles WHERE profile_id = ?').get(profile_id);
        if (existing) {
            return res.status(409).json({ error: 'Profile already in distribution list' });
        }

        const result = db.prepare('INSERT INTO distribution_profiles (profile_id) VALUES (?)').run(profile_id);
        res.json({ id: result.lastInsertRowid, profile_id, created_at: new Date().toISOString() });
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Test the endpoint**

```bash
# Test missing profile_id
curl -X POST http://localhost:3010/api/distribution/profiles -H 'Content-Type: application/json' -d '{}'
# Expected: {"error":"profile_id is required"}

# Test non-existent profile
curl -X POST http://localhost:3010/api/distribution/profiles -H 'Content-Type: application/json' -d '{"profile_id":"999"}'
# Expected: {"error":"Profile not found"}

# Test adding a real profile (replace with actual profile ID)
curl -X POST http://localhost:3010/api/distribution/profiles -H 'Content-Type: application/json' -d '{"profile_id":"<real-id>"}'
# Expected: {"id":1,"profile_id":"<real-id>","created_at":"..."}
```

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add POST /api/distribution/profiles endpoint"
```

---

### Task 4: Add DELETE /api/distribution/profiles/:profileId endpoint

**Files:**
- Modify: `backend/server.js` — add route after the POST route

**Interfaces:**
- Consumes: `distribution_profiles` table (from Task 1)
- Produces: `DELETE /api/distribution/profiles/:profileId` → `{ success: true }`

- [ ] **Step 1: Add the route**

Insert after the POST route from Task 3:

```js
app.delete('/api/distribution/profiles/:profileId', (req, res) => {
    try {
        const { profileId } = req.params;
        const result = db.prepare('DELETE FROM distribution_profiles WHERE profile_id = ?').run(profileId);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Profile not in distribution list' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Test the endpoint**

```bash
# Test removing a profile
curl -X DELETE http://localhost:3010/api/distribution/profiles/<profile-id>
# Expected: {"success":true}

# Test removing a non-existent profile
curl -X DELETE http://localhost:3010/api/distribution/profiles/nonexistent
# Expected: {"error":"Profile not in distribution list"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add DELETE /api/distribution/profiles/:profileId endpoint"
```

---

### Task 5: Add POST /api/distribution/distribute endpoint

**Files:**
- Modify: `backend/server.js` — add route after the DELETE route

**Interfaces:**
- Consumes: `distribution_profiles` table (from Task 1), file system
- Produces: `POST /api/distribution/distribute` — body `{ sourceFolder: string, videosPerProfile: number }` → `{ profiles: [{ profileId, profileName, count, folder }], totalDistributed, totalExpected, missing }`

- [ ] **Step 1: Add the route**

Insert after the DELETE route from Task 4:

```js
app.post('/api/distribution/distribute', (req, res) => {
    try {
        const { sourceFolder, videosPerProfile } = req.body;

        // Validate inputs
        if (!sourceFolder || typeof sourceFolder !== 'string') {
            return res.status(400).json({ error: 'sourceFolder is required' });
        }
        if (!videosPerProfile || !Number.isInteger(videosPerProfile) || videosPerProfile < 1) {
            return res.status(400).json({ error: 'videosPerProfile must be a positive integer' });
        }

        // Check source folder exists
        if (!fs.existsSync(sourceFolder)) {
            return res.status(400).json({ error: 'Source folder does not exist' });
        }
        const sourceStat = fs.statSync(sourceFolder);
        if (!sourceStat.isDirectory()) {
            return res.status(400).json({ error: 'Source path is not a directory' });
        }

        // Get distribution profiles
        const distProfiles = db.prepare(`
            SELECT
                dp.profile_id,
                p.name AS profile_name,
                p.video_folder
            FROM distribution_profiles dp
            JOIN profiles p ON p.id = dp.profile_id
            ORDER BY dp.created_at ASC
        `).all();

        if (distProfiles.length === 0) {
            return res.status(400).json({ error: 'No profiles in distribution list' });
        }

        // Scan source folder for video files
        const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
        const videoFiles = fs.readdirSync(sourceFolder)
            .filter(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
            .map(f => ({ name: f, fullPath: path.join(sourceFolder, f) }));

        if (videoFiles.length === 0) {
            return res.status(400).json({ error: 'No video files found in source folder' });
        }

        const totalExpected = distProfiles.length * videosPerProfile;

        // Initialize profile counters
        const profileCounts = distProfiles.map(p => ({
            ...p,
            count: 0,
            target: videosPerProfile
        }));

        let totalDistributed = 0;
        let videoIndex = 0;

        // Round-robin distribution
        while (videoIndex < videoFiles.length) {
            let assigned = false;
            for (const pc of profileCounts) {
                if (pc.count >= pc.target) continue;
                if (videoIndex >= videoFiles.length) break;

                const video = videoFiles[videoIndex];
                const destDir = pc.video_folder || path.join(UPLOADS_DIR, pc.profile_name);
                const destFile = path.join(destDir, video.name);

                // Create destination directory if it doesn't exist
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                // Move file
                try {
                    fs.renameSync(video.fullPath, destFile);
                    pc.count++;
                    totalDistributed++;
                    videoIndex++;
                    assigned = true;
                } catch (moveErr) {
                    console.error(`[Distribution] Failed to move ${video.name} to ${destFile}:`, moveErr.message);
                    videoIndex++; // Skip this file
                    assigned = true;
                }
            }
            if (!assigned) break; // All profiles have reached their target
        }

        const missing = totalExpected - totalDistributed;

        res.json({
            profiles: profileCounts.map(p => ({
                profileId: p.profile_id,
                profileName: p.profile_name,
                count: p.count,
                folder: p.video_folder || path.join(UPLOADS_DIR, p.profile_name)
            })),
            totalDistributed,
            totalExpected,
            missing
        });
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Test the endpoint**

```bash
# Test with invalid source folder
curl -X POST http://localhost:3010/api/distribution/distribute -H 'Content-Type: application/json' -d '{"sourceFolder":"/nonexistent","videosPerProfile":1}'
# Expected: {"error":"Source folder does not exist"}

# Test with no profiles in distribution list
curl -X POST http://localhost:3010/api/distribution/distribute -H 'Content-Type: application/json' -d '{"sourceFolder":"/tmp","videosPerProfile":1}'
# Expected: {"error":"No profiles in distribution list"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add POST /api/distribution/distribute endpoint"
```

---

### Task 6: Add distribution tab navigation and state in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx` — add tab button in sidebar, add tab content section, add state variables

**Interfaces:**
- Consumes: existing `activeTab` state pattern, existing `axios` instance, existing `setMessage` function
- Produces: new `'distribution'` tab, state variables for distribution feature

- [ ] **Step 1: Add Share2 icon to Lucide imports**

In App.jsx around line 34, add `Share2` to the existing Lucide icon import. Find the closing `} from 'lucide-react';` and add `Share2`:

```jsx
import {
  Plus,
  Play,
  // ... existing imports ...
  Camera,
  Share2   // <-- ADD THIS (alphabetical or at end)
} from 'lucide-react';
```

- [ ] **Step 2: Add distribution state variables**

After the existing state declarations (around line 416, after `editingProfileId`), add:

```jsx
  // Distribution feature state
  const [distributionProfiles, setDistributionProfiles] = useState([]);
  const [showAddDistProfileModal, setShowAddDistProfileModal] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distGroupFilter, setDistGroupFilter] = useState('all');
  const [selectedProfileIds, setSelectedProfileIds] = useState(new Set());
  const [sourceFolder, setSourceFolder] = useState('');
  const [videosPerProfile, setVideosPerProfile] = useState(1);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributeResult, setDistributeResult] = useState(null);
```

- [ ] **Step 3: Add polling for distribution profiles**

In the `fetchData` function (around line 444), add a fetch for distribution profiles alongside the existing parallel fetch. Add after the existing `axios.get('/api/groups')` line:

```js
  const fetchData = async () => {
    try {
      const [pRes, cRes, gRes, dpRes] = await Promise.all([
        axios.get('/api/profiles'),
        axios.get('/api/config'),
        axios.get('/api/groups'),
        axios.get('/api/distribution/profiles')
      ]);
      // ... existing code ...
      setDistributionProfiles(dpRes.data || []);
```

- [ ] **Step 4: Add tab button in sidebar**

In the sidebar `<nav>` (after the Settings button around line 1457), add the new tab button right before the closing `</nav>`:

```jsx
            <button
              onClick={() => setActiveTab('distribution')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: activeTab === 'distribution' ? 'rgba(255, 63, 182, 0.1)' : 'transparent',
                color: activeTab === 'distribution' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                marginTop: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Share2 size={20} /> Phân Phối Video
            </button>
```

- [ ] **Step 5: Add tab content section placeholder**

After the `) : activeTab === 'settings' ? (` section (around line 2760+), find the closing structure. Add a new conditional branch before the final `: null` or closing `)}`:

```jsx
          ) : activeTab === 'distribution' ? (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>Phân Phối Video</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Chọn profile và phân phối video vào các folder upload</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddDistProfileModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={18} /> Thêm Profile
                </button>
              </div>

              {/* Distribution profile cards */}
              <div style={{ marginBottom: '24px' }}>
                {distributionProfiles.length === 0 ? (
                  <div className="glass" style={{ padding: '48px 24px', borderRadius: '20px', textAlign: 'center' }}>
                    <Share2 size={40} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>Chưa có profile nào được chọn</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Thêm profile để bắt đầu phân phối video</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowAddDistProfileModal(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Plus size={18} /> Thêm Profile
                    </button>
                  </div>
                ) : (
                  <div className="profile-grid">
                    {distributionProfiles.map(dp => (
                      <motion.div
                        key={dp.profile_id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass card"
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '4px' }}>{dp.profile_name}</div>
                              {dp.group_name && (
                                <span className="badge" style={{ fontSize: '0.75rem' }}>{dp.group_name}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveDistProfile(dp.profile_id)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', minWidth: 'unset' }}
                              title="Xoá khỏi danh sách"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FolderOpen size={14} />
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>{dp.video_folder || '(default)'}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Distribute button */}
              {distributionProfiles.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSourceFolder('');
                      setVideosPerProfile(1);
                      setDistributeResult(null);
                      setShowDistributeModal(true);
                    }}
                    disabled={isDistributing}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      fontSize: '1.05rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    <Share2 size={20} /> Phân Phối Video
                  </button>
                </div>
              )}
            </section>
```

- [ ] **Step 6: Add handler function for removing a profile**

Add this function alongside other handler functions in App.jsx (near other handlers like `handleDeleteProfile`):

```jsx
  const handleRemoveDistProfile = async (profileId) => {
    try {
      await axios.delete(`/api/distribution/profiles/${profileId}`);
      setDistributionProfiles(prev => prev.filter(p => p.profile_id !== profileId));
      setMessage({ type: 'success', text: 'Đã xoá profile khỏi danh sách phân phối' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi khi xoá profile' });
    }
  };
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add distribution tab with profile list and navigation"
```

---

### Task 7: Add "Thêm Profile" modal

**Files:**
- Modify: `frontend/src/App.jsx` — add modal JSX and handler

**Interfaces:**
- Consumes: existing profiles, groups state; `distributionProfiles` state; `setMessage`
- Produces: modal UI for selecting profiles to add to distribution list

- [ ] **Step 1: Add handler function**

Add alongside other handlers:

```jsx
  const handleAddDistProfiles = async () => {
    const ids = [...selectedProfileIds];
    if (ids.length === 0) return;

    let added = 0;
    let errors = 0;
    for (const profileId of ids) {
      try {
        await axios.post('/api/distribution/profiles', { profile_id: profileId });
        added++;
      } catch (err) {
        if (err.response?.status === 409) {
          // Already in list, skip
        } else {
          errors++;
        }
      }
    }

    setSelectedProfileIds(new Set());
    setShowAddDistProfileModal(false);

    // Refresh distribution list
    try {
      const dpRes = await axios.get('/api/distribution/profiles');
      setDistributionProfiles(dpRes.data || []);
    } catch (e) { /* ignore */ }

    if (added > 0) {
      setMessage({ type: 'success', text: `Đã thêm ${added} profile vào danh sách phân phối` });
    }
    if (errors > 0) {
      setMessage({ type: 'error', text: `Có ${errors} lỗi khi thêm profile` });
    }
  };

  // Compute profiles NOT already in distribution (for the modal)
  const availableForDist = useMemo(() => {
    const distIds = new Set(distributionProfiles.map(p => p.profile_id));
    return profiles.filter(p => !distIds.has(p.id));
  }, [profiles, distributionProfiles]);

  const filteredDistAvailable = useMemo(() => {
    if (distGroupFilter === 'all') return availableForDist;
    if (distGroupFilter === 'ungrouped') {
      return availableForDist.filter(p => !p.group_id);
    }
    return availableForDist.filter(p => p.group_id === distGroupFilter);
  }, [availableForDist, distGroupFilter]);
```

- [ ] **Step 2: Add modal JSX**

Place this modal alongside the other modals (near the end of App.jsx, before the final closing of the component). Use the same pattern as other modals:

```jsx
          {/* Add Distribution Profile Modal */}
          <AnimatePresence>
            {showAddDistProfileModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '24px'
                }}
                onClick={() => {
                  setSelectedProfileIds(new Set());
                  setShowAddDistProfileModal(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  className="glass"
                  style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Thêm Profile</h3>
                      <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Chọn profile để thêm vào danh sách phân phối</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfileIds(new Set());
                        setShowAddDistProfileModal(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                      aria-label="Close modal"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Group
                      <select
                        className="input"
                        style={{ padding: '8px 12px', minWidth: '180px' }}
                        value={distGroupFilter}
                        onChange={(e) => setDistGroupFilter(e.target.value)}
                      >
                        <option value="all">Tất cả</option>
                        <option value="ungrouped">Ungrouped</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={{ maxHeight: '360px', overflowY: 'auto', marginBottom: '20px' }}>
                    {filteredDistAvailable.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                        <p>Không có profile nào khả dụng</p>
                      </div>
                    ) : (
                      filteredDistAvailable.map(p => (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            background: selectedProfileIds.has(p.id) ? 'rgba(255, 63, 182, 0.08)' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProfileIds.has(p.id)}
                            onChange={() => {
                              setSelectedProfileIds(prev => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              });
                            }}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{p.name}</div>
                            {p.group_name && (
                              <span className="badge" style={{ fontSize: '0.7rem', marginTop: '2px' }}>{p.group_name}</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedProfileIds(new Set());
                        setShowAddDistProfileModal(false);
                      }}
                    >
                      Huỷ
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAddDistProfiles}
                      disabled={selectedProfileIds.size === 0}
                    >
                      Thêm ({selectedProfileIds.size})
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add Thêm Profile modal for distribution"
```

---

### Task 8: Add "Phân Phối Video" modal

**Files:**
- Modify: `frontend/src/App.jsx` — add modal JSX and submit handler

**Interfaces:**
- Consumes: `distributionProfiles`, `sourceFolder`, `videosPerProfile`, `isDistributing`, `distributeResult` state
- Produces: modal with source folder input, videos-per-profile input, distribute button, result display

- [ ] **Step 1: Add submit handler**

Add alongside other handlers:

```jsx
  const handleDistribute = async () => {
    if (!sourceFolder.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập folder nguồn' });
      return;
    }
    if (videosPerProfile < 1) {
      setMessage({ type: 'error', text: 'Số lượng video mỗi profile phải >= 1' });
      return;
    }

    setIsDistributing(true);
    setDistributeResult(null);
    try {
      const res = await axios.post('/api/distribution/distribute', {
        sourceFolder: sourceFolder.trim(),
        videosPerProfile
      });
      setDistributeResult(res.data);
      if (res.data.missing > 0) {
        setMessage({ type: 'warning', text: `Đã phân phối ${res.data.totalDistributed}/${res.data.totalExpected} video. Thiếu ${res.data.missing} video.` });
      } else {
        setMessage({ type: 'success', text: `Đã phân phối thành công ${res.data.totalDistributed} video!` });
      }
    } catch (err) {
      setDistributeResult({ error: err.response?.data?.error || 'Lỗi khi phân phối video' });
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi khi phân phối video' });
    } finally {
      setIsDistributing(false);
    }
  };
```

- [ ] **Step 2: Add modal JSX**

Place alongside other modals (after the "Thêm Profile" modal from Task 7):

```jsx
          {/* Distribute Video Modal */}
          <AnimatePresence>
            {showDistributeModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '24px'
                }}
                onClick={() => {
                  if (!isDistributing) {
                    setDistributeResult(null);
                    setShowDistributeModal(false);
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  className="glass"
                  style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Phân Phối Video</h3>
                      <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        {distributionProfiles.length} profile được chọn
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDistributing) {
                          setDistributeResult(null);
                          setShowDistributeModal(false);
                        }
                      }}
                      disabled={isDistributing}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: isDistributing ? 'not-allowed' : 'pointer',
                        opacity: isDistributing ? 0.45 : 1
                      }}
                      aria-label="Close modal"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {!distributeResult ? (
                    <>
                      <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                        <div className="input-group">
                          <label>Folder Nguồn</label>
                          <input
                            className="input"
                            placeholder="/path/to/videos"
                            value={sourceFolder}
                            onChange={(e) => setSourceFolder(e.target.value)}
                            disabled={isDistributing}
                            autoFocus
                          />
                        </div>

                        <div className="input-group">
                          <label>Số lượng video mỗi profile</label>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            value={videosPerProfile}
                            onChange={(e) => setVideosPerProfile(Math.max(1, parseInt(e.target.value) || 1))}
                            disabled={isDistributing}
                          />
                        </div>

                        <div style={{
                          padding: '12px 16px',
                          borderRadius: '12px',
                          background: 'rgba(99, 102, 241, 0.08)',
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)'
                        }}>
                          <strong>{distributionProfiles.length}</strong> profile × <strong>{videosPerProfile}</strong> video = <strong style={{ color: 'var(--accent)' }}>{distributionProfiles.length * videosPerProfile} video</strong> cần phân phối
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setDistributeResult(null);
                            setShowDistributeModal(false);
                          }}
                          disabled={isDistributing}
                        >
                          Huỷ
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={handleDistribute}
                          disabled={isDistributing || !sourceFolder.trim()}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {isDistributing ? (
                            <>
                              <RefreshCw size={18} className="animate-pulse" />
                              Đang phân phối...
                            </>
                          ) : (
                            <>
                              <Play size={18} />
                              Phân Phối
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Result display */}
                      {distributeResult.error ? (
                        <div style={{
                          padding: '20px',
                          borderRadius: '16px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          marginBottom: '20px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', marginBottom: '8px' }}>
                            <AlertCircle size={20} />
                            <span style={{ fontWeight: '600' }}>Lỗi</span>
                          </div>
                          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{distributeResult.error}</p>
                        </div>
                      ) : (
                        <div style={{
                          padding: '20px',
                          borderRadius: '16px',
                          background: distributeResult.missing > 0
                            ? 'rgba(251, 191, 36, 0.08)'
                            : 'rgba(34, 197, 94, 0.08)',
                          marginBottom: '20px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: distributeResult.missing > 0 ? 'var(--warning, #FBBF24)' : 'var(--success)',
                            marginBottom: '12px'
                          }}>
                            {distributeResult.missing > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                            <span style={{ fontWeight: '600' }}>
                              {distributeResult.missing > 0
                                ? `Đã phân phối ${distributeResult.totalDistributed}/${distributeResult.totalExpected} video`
                                : `Đã phân phối thành công ${distributeResult.totalDistributed} video!`
                              }
                            </span>
                          </div>
                          {distributeResult.missing > 0 && (
                            <p style={{ color: 'var(--text-muted)', margin: '0 0 12px 0', fontSize: '0.9rem' }}>
                              Thiếu {distributeResult.missing} video (folder nguồn không đủ)
                            </p>
                          )}
                          {/* Per-profile breakdown */}
                          <div style={{ display: 'grid', gap: '6px' }}>
                            {distributeResult.profiles.map(p => (
                              <div key={p.profileId} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.04)',
                                fontSize: '0.85rem'
                              }}>
                                <span style={{ fontWeight: '500' }}>{p.profileName}</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {p.count} video → <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{p.folder}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setDistributeResult(null);
                            setShowDistributeModal(false);
                            setSourceFolder('');
                          }}
                        >
                          Đóng
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add Phân Phối Video modal with distribute logic"
```

---

### Task 9: Final end-to-end verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks

- [ ] **Step 1: Restart the backend**

```bash
cd /Users/its/Documents/Codes/upload_tiktok
# Kill existing server if running, then:
node backend/server.js &
```

- [ ] **Step 2: Restart the frontend**

```bash
cd /Users/its/Documents/Codes/upload_tiktok/frontend
npm run dev &
```

- [ ] **Step 3: Manual verification checklist**

Open `http://localhost:3009` and verify:

1. **Tab appears**: "Phân Phối Video" tab is visible in the sidebar with Share2 icon
2. **Tab click**: Clicking the tab shows the distribution page with empty state
3. **Empty state**: Shows "Chưa có profile nào được chọn" with a button to add
4. **Add Profile modal**: Clicking "Thêm Profile" opens the modal
5. **Group filter**: The group dropdown works — filters profiles by group
6. **Checkbox**: Can select/deselect multiple profiles
7. **Add action**: Clicking "Thêm (N)" adds selected profiles, modal closes, profiles appear as cards
8. **Profile cards**: Each card shows profile name, group badge, video folder, and remove button
9. **Remove**: Clicking trash icon removes profile from list
10. **Distribute button**: Shows "Phân Phối Video" button when profiles exist
11. **Distribute modal**: Opens with source folder input and video count input
12. **Live summary**: Shows "X profile × Y video = Z video"
13. **Distribute action**: Enter a valid folder path with videos, set count, click "Phân Phối"
14. **Result display**: Shows success/partial/error with per-profile breakdown
15. **Source cleanup**: Videos are moved (not copied) from source folder

- [ ] **Step 4: Commit if any final tweaks were made**

```bash
git add -A
git commit -m "chore: final polish on video distribution feature"
```
