# Avatar Change Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ability to change a TikTok profile's avatar via browser automation (native file picker + Playwright).

**Architecture:** Follows the existing pattern of the project — database migration for new column, Express API routes for file selection and browser automation, React state management for UI. The avatar change automation reuses the persistent browser context pattern from `open-profile` and `login-tiktok`.

**Tech Stack:** Node.js + Express, better-sqlite3, Playwright (chromium), React + Vite, axios

## Global Constraints

- Database migration must add `avatar_image TEXT` column to `profiles` table
- File picker must use native OS dialog (macOS: `osascript`, Windows: `powershell`) matching the existing `select-folder` pattern
- Avatar automation must use persistent browser context to reuse cookies/sessions
- Must prevent concurrent operations via `avatarChangingProfiles` Set
- Profile status must be updated during avatar change operation

---

### Task 1: Database Migration — Add `avatar_image` Column

**Files:**
- Modify: `backend/server.js` (add migration after line 229)

**Interfaces:**
- Produces: `avatar_image` TEXT column on `profiles` table (stores path to selected avatar image file)

- [ ] **Step 1: Add the migration block**

Insert after line 229 (after the `pass_email` field migration loop closing brace):

```js

// Migration: avatar_image — path to avatar image file for profile
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasAvatarImage = tableInfo.some((col) => col.name === 'avatar_image');
    if (!hasAvatarImage) {
        db.exec('ALTER TABLE profiles ADD COLUMN avatar_image TEXT;');
        console.log('Added avatar_image column to profiles table');
    }
} catch (err) {
    console.error('Migration error (avatar_image column):', err);
}
```

- [ ] **Step 2: Start backend and verify migration runs**

Run: `cd backend && node server.js`
Expected: Console shows "Added avatar_image column to profiles table" (if column doesn't exist yet) or no error.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add avatar_image column migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend API — `POST /api/select-image-file`

**Files:**
- Modify: `backend/server.js` (add after `/api/select-folder` route at line 762)

**Interfaces:**
- Consumes: None (standalone route)
- Produces: `POST /api/select-image-file` → `{ path: string | null }`

- [ ] **Step 1: Add the `/api/select-image-file` route**

Insert after line 762:

```js

app.post('/api/select-image-file', (req, res) => {
    let script = '';

    if (process.platform === 'darwin') {
        script = `osascript -e 'POSIX path of (choose file of type {"public.png","public.jpeg","com.compuserve.gif"} with prompt "Select Avatar Image")'`;
    } else if (process.platform === 'win32') {
        script = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; \$dialog = New-Object System.Windows.Forms.OpenFileDialog; \$dialog.Filter = 'Image Files (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg'; \$dialog.Title = 'Select Avatar Image'; if (\$dialog.ShowDialog() -eq 'OK') { \$dialog.FileName }"`;
    } else {
        return res.status(501).json({ error: 'File picker not supported on this platform' });
    }

    exec(script, (error, stdout, stderr) => {
        if (error) {
            console.error(`Image file picker error: ${error.message}`);
            return res.status(500).json({ error: 'File selection cancelled or failed' });
        }
        const selectedPath = stdout.trim();
        if (!selectedPath) return res.status(500).json({ error: 'No file selected' });
        res.json({ path: selectedPath });
    });
});
```

- [ ] **Step 2: Start backend and test the endpoint**

Run: `cd backend && node server.js`
Test: `curl -X POST http://localhost:3010/api/select-image-file`
Expected: macOS file picker opens (image filter). After selecting an image, response is `{"path":"/path/to/image.png"}`.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add /api/select-image-file endpoint for native avatar image picker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend API — `POST /api/change-avatar` and Browser Automation

**Files:**
- Modify: `backend/server.js` (add `avatarChangingProfiles` Set at line 788, add route after `/api/open-profile` at line 1242, add `changeAvatar()` function)

**Interfaces:**
- Consumes: `manualBrowsers` Map (pattern), `PROFILES_DIR`, `chromium.launchPersistentContext`, `parseProxy`
- Produces: `POST /api/change-avatar` → `{ status: string, profile: string }`
- Side effect: Stores/tracks session in `avatarChangingProfiles` Set

- [ ] **Step 1: Add `avatarChangingProfiles` Set**

Insert after line 788 (`const loggingInProfiles = new Map();`):

```js
const avatarChangingProfiles = new Set(); // profileId set — prevents concurrent avatar changes
```

- [ ] **Step 2: Add the `changeAvatar` automation function**

Add before the `/api/change-avatar` route handler (we'll add the route in step 3). Insert after line 1242 (end of `/api/open-profile` route):

```js

async function changeAvatar(profile) {
    const profileId = profile.id;
    const userDataDir = path.join(PROFILES_DIR, profile.name);

    const log = (msg) => {
        const entry = `[${new Date().toISOString()}] [${profile.name}][AVATAR] ${msg}\n`;
        console.log(entry.trim());
        try {
            fs.appendFileSync(path.join(__dirname, 'automation.log'), entry);
        } catch (e) {}
    };

    if (!profile.avatar_image) throw new Error('No avatar image configured for this profile');
    if (!fs.existsSync(profile.avatar_image)) throw new Error(`Avatar image not found: ${profile.avatar_image}`);

    const browserOptions = {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    };
    if (profile.proxy) {
        const proxyConfig = parseProxy(profile.proxy);
        if (proxyConfig) browserOptions.proxy = proxyConfig;
    }

    const browser = await chromium.launchPersistentContext(userDataDir, browserOptions);
    avatarChangingProfiles.add(profileId);
    db.prepare("UPDATE profiles SET status = ? WHERE id = ?").run('changing_avatar', profileId);

    log('Avatar change session started');

    try {
        const page = await browser.newPage();

        // Step 1: Navigate to TikTok — check login state
        log('Navigating to TikTok...');
        await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        log(`Current URL: ${currentUrl}`);

        // Step 2: Go to profile page via the profile icon/menu
        const profileIconSelectors = [
            '#header-profile-avatar',
            '[data-e2e="profile-icon"]',
            'a[href*="/@"]',
            'div[class*="avatar"]:not([class*="upload"])',
        ];
        let profileIcon = null;
        for (const sel of profileIconSelectors) {
            profileIcon = await page.$(sel);
            if (profileIcon && await profileIcon.isVisible().catch(() => false)) break;
            profileIcon = null;
        }

        if (profileIcon) {
            await profileIcon.click();
            log('Clicked profile icon');
            await page.waitForTimeout(2000);
        }

        // Try to find and click "View profile" link
        const viewProfileSelectors = [
            'a[href*="/@"]:has-text("View profile")',
            ':text("View profile")',
            'a:has-text("View profile")',
        ];
        for (const sel of viewProfileSelectors) {
            const link = await page.$(sel);
            if (link && await link.isVisible().catch(() => false)) {
                await link.click();
                log('Clicked "View profile"');
                await page.waitForTimeout(3000);
                break;
            }
        }

        // Step 3: Click on the avatar area to trigger edit/upload
        const profileUrl = page.url();
        log(`Profile page URL: ${profileUrl}`);

        // Look for Edit profile button
        const editProfileSelectors = [
            ':text("Edit profile")',
            'button:has-text("Edit profile")',
            'a:has-text("Edit profile")',
            '[data-e2e="edit-profile"]',
        ];
        for (const sel of editProfileSelectors) {
            const btn = await page.$(sel);
            if (btn && await btn.isVisible().catch(() => false)) {
                await btn.click();
                log('Clicked "Edit profile"');
                await page.waitForTimeout(3000);
                break;
            }
        }

        // Step 4: Click on the avatar image to trigger upload dialog
        const avatarClickSelectors = [
            'div[class*="avatar"] img',
            'img[class*="avatar"]',
            'div[class*="profile"] img',
            'div[class*="edit"] img',
            'img[alt*="avatar" i]',
            'img[alt*="profile" i]',
            'div[role="button"] img',
            'div[class*="photo"] img',
        ];
        let avatarElement = null;
        for (const sel of avatarClickSelectors) {
            avatarElement = await page.$(sel);
            if (avatarElement && await avatarElement.isVisible().catch(() => false)) break;
            avatarElement = null;
        }

        if (avatarElement) {
            await avatarElement.click();
            log('Clicked avatar element');
            await page.waitForTimeout(2000);
        }

        // Step 5: Find file input and upload the avatar image
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(profile.avatar_image);
            log(`Avatar image set: ${profile.avatar_image}`);
            await page.waitForTimeout(3000);
        } else {
            log('Warning: No file input found on page');
        }

        // Step 6: Click save/confirm
        const saveSelectors = [
            'button:has-text("Save")',
            'button:has-text("Confirm")',
            'button:has-text("Done")',
            'button:has-text("Apply")',
            ':text("Save")',
            'div[role="button"]:has-text("Save")',
        ];
        for (const sel of saveSelectors) {
            const saveBtn = await page.$(sel);
            if (saveBtn && await saveBtn.isVisible().catch(() => false)) {
                await saveBtn.click();
                log('Clicked save/confirm');
                await page.waitForTimeout(3000);
                break;
            }
        }

        log('Avatar change flow completed');
    } catch (err) {
        log(`Avatar change error: ${err.message}`);
        throw err;
    } finally {
        avatarChangingProfiles.delete(profileId);
        await browser.close().catch(() => null);
        db.prepare("UPDATE profiles SET status = 'idle' WHERE id = ?").run(profileId);
        log('Avatar change session ended, browser closed.');
    }
}
```

- [ ] **Step 3: Add the `/api/change-avatar` route**

Insert after the `changeAvatar` function:

```js

app.post('/api/change-avatar', async (req, res) => {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (runningProfiles.has(profileId) || processingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently running automation or processing a video' });
    }

    if (avatarChangingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is already changing avatar' });
    }

    if (!profile.avatar_image) {
        return res.status(400).json({ error: 'No avatar image selected. Please select an image first.' });
    }

    res.json({ status: 'started', profile: profile.name });

    // Run async — fire and forget
    changeAvatar(profile).catch((err) => {
        console.error(`[${profile.name}] Avatar change failed:`, err.message);
    });
});
```

- [ ] **Step 4: Start backend and verify the route is registered**

Run: `cd backend && node server.js`
Expected: No errors on startup. Server runs on port 3010.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js
git commit -m "feat: add /api/change-avatar endpoint with browser automation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend — Avatar UI in ProfileCard + App Handlers

**Files:**
- Modify: `frontend/src/App.jsx` (ProfileCard props, ProfileCard avatar row, ProfileCard action buttons, App state, App handlers)

**Interfaces:**
- Consumes: `POST /api/select-image-file`, `POST /api/change-avatar`, `PATCH /api/profiles/:id`
- Produces: Avatar file picker row + CHANGE AVATAR button in each ProfileCard

- [ ] **Step 1: Add avatar props to ProfileCard destructuring**

At line 38-67, add these new props to the destructured object (add after `onUpdateNeedContentCheck` at line 61):

```jsx
  onSelectAvatar,
  onChangeAvatar,
  isChangingAvatar,
```

Updated destructuring (relevant section):
```jsx
  onUpdateNeedContentCheck,
  onSelectAvatar,
  onChangeAvatar,
  isChangingAvatar,
  groups,
```

- [ ] **Step 2: Add avatar image file picker row in ProfileCard**

Insert after the "Upload Folder" row (after line 246 `</div>` that closes the Upload Folder section). Add before the Proxy Server section at line 248:

```jsx

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Image size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Avatar Image</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1 }}
                    placeholder="Select an image..."
                    value={profile.avatar_image || ''}
                    readOnly
                  />
                  <button
                    onClick={() => onSelectAvatar(profile.id)}
                    className="btn-secondary"
                    style={{ padding: '8px', minWidth: 'auto' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
```

- [ ] **Step 3: Add Image and Camera icons to lucide-react import**

At lines 3-31, add `Image` and `Camera` to the lucide-react named imports:

```jsx
import {
  Plus,
  Play,
  Trash2,
  Settings,
  Globe,
  Video,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layout,
  Clock,
  ShieldCheck,
  Zap,
  FolderOpen,
  Link,
  ExternalLink,
  Edit3,
  Check,
  X,
  Users,
  Music,
  ChevronDown,
  ChevronRight,
  Heart,
  StopCircle,
  Upload,
  LogIn,
  Image,
  Camera
} from 'lucide-react';
```

- [ ] **Step 4: Add CHANGE AVATAR button in ProfileCard action buttons row**

Insert after the LOGIN button (after line 545, before the `</div>` that closes the action buttons row, which is at line 546):

```jsx

                  {/* Change Avatar Button */}
                  <button
                    className="btn"
                    onClick={() => onChangeAvatar(profile.id)}
                    disabled={profile.status === 'uploading' || !profile.avatar_image || isChangingAvatar}
                    title={!profile.avatar_image ? 'Select an avatar image first' : (isChangingAvatar ? 'Avatar change in progress...' : 'Change TikTok avatar')}
                    style={{
                      background: isChangingAvatar
                        ? 'rgba(59, 130, 246, 0.12)'
                        : 'rgba(59, 130, 246, 0.08)',
                      color: isChangingAvatar ? '#3B82F6' : '#60A5FA',
                      border: '1px solid rgba(59,130,246,0.25)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      gap: '6px',
                      fontWeight: '700',
                      transition: 'all 0.2s',
                      cursor: (profile.status === 'uploading' || !profile.avatar_image) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isChangingAvatar ? (
                      <RefreshCw size={14} className="animate-pulse" />
                    ) : (
                      <Camera size={14} />
                    )}
                    AVATAR
                  </button>
```

- [ ] **Step 5: Add App state variables**

After line 583 (`const [loggingInProfiles, setLoggingInProfiles] = useState(() => new Set());`):

```jsx
  const [changingAvatarProfiles, setChangingAvatarProfiles] = useState(() => new Set());
```

- [ ] **Step 6: Add `selectAvatarPath` and `handleSelectAvatar` functions**

After `handleSelectFolder` function (after line 1228), add:

```jsx
  const selectAvatarPath = async () => {
    try {
      const res = await axios.post('/api/select-image-file');
      return res.data?.path || null;
    } catch (err) {
      console.error('Image file selection cancelled or failed');
      return null;
    }
  };

  const handleSelectAvatar = async (id) => {
    setIsSelectingFolder(true);
    try {
      const selectedPath = await selectAvatarPath();
      if (selectedPath) {
        const processingKey = `avatar-${id}`;
        if (processingRef.current.has(processingKey)) return;
        processingRef.current.add(processingKey);
        try {
          await axios.patch(`/api/profiles/${id}`, { avatar_image: selectedPath });
        } finally {
          processingRef.current.delete(processingKey);
        }
      }
    } finally {
      setIsSelectingFolder(false);
    }
  };
```

- [ ] **Step 7: Add `handleChangeAvatar` function**

After `handleSelectAvatar`:

```jsx
  const handleChangeAvatar = async (profileId) => {
    try {
      setChangingAvatarProfiles(prev => new Set([...prev, profileId]));
      await axios.post('/api/change-avatar', { profileId });
      setMessage({ type: 'success', text: 'Avatar change started! Browser will open shortly.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setChangingAvatarProfiles(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to change avatar' });
    }
  };
```

- [ ] **Step 8: Update `getStatusColor` to handle `changing_avatar` status**

At line 1242-1252, add `changing_avatar` case:

```jsx
  const getStatusColor = (status) => {
    switch (status) {
      case 'uploading': return 'var(--accent)';
      case 'logging_in': return '#10B981';
      case 'engaging': return '#EC4899';
      case 'changing_avatar': return '#3B82F6';
      case 'success': return 'var(--success)';
      case 'error': return 'var(--error)';
      case 'no_videos': return '#EAB308';
      default: return 'var(--text-muted)';
    }
  };
```

- [ ] **Step 9: Pass new props to ProfileCard render**

In the `filteredProfiles.map()` section where `<ProfileCard` is rendered, add the new props. Find the ProfileCard JSX (around line 1542 where `filteredProfiles.map` is used) and add these props:

```jsx
              onSelectAvatar={handleSelectAvatar}
              onChangeAvatar={handleChangeAvatar}
              isChangingAvatar={changingAvatarProfiles.has(profile.id)}
```

- [ ] **Step 10: Add `changingAvatarProfiles` sync to `fetchData`**

In the `fetchData` function, after the `loggingInProfiles` sync block (after line 655), add:

```jsx

      // Sync changing avatar status from profile status field
      setChangingAvatarProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'changing_avatar') next.add(p.id);
          else next.delete(p.id);
        });
        return next;
      });
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add avatar image picker and CHANGE AVATAR button to profile cards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Integration Test — End-to-End Verification

**Files:**
- None (manual verification)

- [ ] **Step 1: Start both backend and frontend**

```bash
cd backend && node server.js &
cd frontend && npm run dev
```

- [ ] **Step 2: Verify ProfileCard shows avatar row**

Open browser at `http://localhost:3009`.
Expected: Each expanded ProfileCard shows "Avatar Image" row with read-only input + Browse button.

- [ ] **Step 3: Test file picker**

Click "Browse" for a profile.
Expected: Native OS file picker opens with image filter. Selecting an image updates the avatar_image path in the UI.

- [ ] **Step 4: Verify CHANGE AVATAR button**

Expected: Button is enabled when avatar_image is set, disabled when empty. Blue styling with Camera icon.

- [ ] **Step 5: Test full flow**

1. Select an avatar image for a profile that has a logged-in TikTok session
2. Click CHANGE AVATAR
Expected: Message "Avatar change started!", browser opens, navigates to TikTok profile, attempts to change avatar

- [ ] **Step 6: Test error cases**

- Click CHANGE AVATAR without selecting image → error message
- Click CHANGE AVATAR while profile is uploading → button disabled
- Click CHANGE AVATAR while already changing → 400 error

- [ ] **Step 7: Commit any fixes**

Only if issues found and fixed.
