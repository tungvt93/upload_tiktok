# Add Favorite Music Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ability to favorite a TikTok music/sound by search term via browser automation, with a text input + "ADD FAVORITES" button per profile.

**Architecture:** Follows the same pattern as avatar change — database migration for new column, Express API route for browser automation, React state management for UI. The music automation reuses the persistent browser context pattern and the Sounds panel selectors from the existing upload flow.

**Tech Stack:** Node.js + Express, better-sqlite3, Playwright (chromium), React + Vite, axios

## Global Constraints

- Database migration must add `music_search TEXT` column to `profiles` table
- Automation must use persistent browser context to reuse cookies/sessions
- Must prevent concurrent operations via `addingFavoriteMusicProfiles` Set
- Profile status must be updated during the operation
- Search term is user-provided via text input (not native file picker)
- No search term → 400 error
- Profile not found → 404 error
- Profile running another operation → 400 error

---

### Task 1: Database Migration — Add `music_search` Column

**Files:**
- Modify: `backend/server.js` (add migration after avatar_image migration block at line 241)

**Interfaces:**
- Produces: `music_search TEXT` column on `profiles` table (stores the search term for favorite music)

- [ ] **Step 1: Add the migration block**

Insert after line 241 (after the closing `}` of the `avatar_image` migration catch block):

```js

// Migration: music_search — search term for adding favorite music
try {
    const tableInfo = db.prepare('PRAGMA table_info(profiles)').all();
    const hasMusicSearch = tableInfo.some((col) => col.name === 'music_search');
    if (!hasMusicSearch) {
        db.exec('ALTER TABLE profiles ADD COLUMN music_search TEXT;');
        console.log('Added music_search column to profiles table');
    }
} catch (err) {
    console.error('Migration error (music_search column):', err);
}
```

- [ ] **Step 2: Start backend and verify migration runs**

Run: `cd backend && node server.js`
Expected: Console shows "Added music_search column to profiles table" (if column doesn't exist) or no error.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add music_search column migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — `POST /api/add-favorite-music` and Browser Automation

**Files:**
- Modify: `backend/server.js` (add `addingFavoriteMusicProfiles` Set at line 822, add `addFavoriteMusic()` function after `/api/change-avatar` route at line 1459, add route)

**Interfaces:**
- Consumes: `manualBrowsers` Map (pattern), `PROFILES_DIR`, `chromium.launchPersistentContext`, `parseProxy`
- Produces: `POST /api/add-favorite-music` → `{ status: "started", profile: string }`
- Side effect: Stores/tracks session in `addingFavoriteMusicProfiles` Set

- [ ] **Step 1: Add `addingFavoriteMusicProfiles` Set**

At line 822 (after `const avatarChangingProfiles = new Set();`), add:

```js
const addingFavoriteMusicProfiles = new Set(); // profileId set — prevents concurrent favorite music operations
```

- [ ] **Step 2: Add the `addFavoriteMusic` automation function**

Insert after line 1459 (end of `/api/change-avatar` route handler):

```js

async function addFavoriteMusic(profile, searchTerm) {
    const profileId = profile.id;
    const userDataDir = path.join(PROFILES_DIR, profile.name);

    const log = (msg) => {
        const entry = `[${new Date().toISOString()}] [${profile.name}][FAV-MUSIC] ${msg}\n`;
        console.log(entry.trim());
        try {
            fs.appendFileSync(path.join(__dirname, 'automation.log'), entry);
        } catch (e) {}
    };

    const browserOptions = {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    };
    if (profile.proxy) {
        const proxyConfig = parseProxy(profile.proxy);
        if (proxyConfig) browserOptions.proxy = proxyConfig;
    }

    const browser = await chromium.launchPersistentContext(userDataDir, browserOptions);
    addingFavoriteMusicProfiles.add(profileId);
    db.prepare("UPDATE profiles SET status = ? WHERE id = ?").run('adding_favorite_music', profileId);

    log(`Searching for music: "${searchTerm}"`);

    try {
        const page = await browser.newPage();

        // Step 1: Navigate to upload page
        log('Navigating to upload page...');
        await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Step 2: Wait for upload page to load and click Sounds button
        log('Looking for Sounds button...');
        let soundsBtn = null;
        try {
            soundsBtn = await page.waitForSelector('button[data-button-name="sounds"]', { timeout: 30000, state: 'visible' });
        } catch (e) {
            log(`Sounds button not found directly: ${e.message}`);
            // Try clicking Edit video first to reveal Sounds button
            try {
                const editBtn = await page.$('button:has-text("Edit video"), button:has-text("Edit")');
                if (editBtn && await editBtn.isVisible()) {
                    log('Clicking Edit Video first...');
                    await editBtn.click();
                    await page.waitForTimeout(3000);
                    soundsBtn = await page.waitForSelector('button[data-button-name="sounds"]', { timeout: 10000, state: 'visible' }).catch(() => null);
                }
            } catch (e2) {
                log(`Edit video approach failed: ${e2.message}`);
            }
        }

        if (!soundsBtn) {
            log('ERROR: Sounds button not found on upload page');
            return;
        }

        log('Clicking Sounds button...');
        await soundsBtn.click();
        await page.waitForTimeout(3000);

        // Step 3: Find the search input in the Sounds panel
        log('Looking for search input in Sounds panel...');
        const searchInputSelectors = [
            'input[class*="Search"]',
            'input[placeholder*="search" i]',
            'input[placeholder*="sound" i]',
            'input[placeholder*="music" i]',
            '[data-e2e="music-search"] input',
            '[data-e2e="sound-search"] input',
            'input[type="search"]',
            '.music-search input',
            'input[class*="search" i]',
        ];

        let searchInput = null;
        for (const sel of searchInputSelectors) {
            searchInput = await page.$(sel);
            if (searchInput && await searchInput.isVisible().catch(() => false)) {
                log(`Found search input via: ${sel}`);
                break;
            }
            searchInput = null;
        }

        if (!searchInput) {
            log('ERROR: Search input not found in Sounds panel');
            // Take screenshot for debugging
            await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_no_search.png`) }).catch(() => null);
            return;
        }

        // Step 4: Type search term
        log(`Typing search term: "${searchTerm}"`);
        await searchInput.click();
        await page.waitForTimeout(500);
        await searchInput.fill(searchTerm);
        await page.keyboard.press('Enter');
        log('Search submitted, waiting for results...');
        await page.waitForTimeout(4000);

        // Step 5: Find and click star/bookmark on first result
        log('Looking for star/bookmark button on first result...');

        // The star/bookmark icon in search results — same as the "add to favorites" plus-bold icon
        const starSelectors = [
            '[data-icon="plus-bold"]',
            'div[class*="MusicResult"] [data-icon="plus-bold"]',
            'div[class*="music"] [data-icon="plus-bold"]',
            // Fallback: look for any visible plus-bold that's not in sidebar
        ];

        let starIcon = null;
        for (const sel of starSelectors) {
            starIcon = await page.$(sel);
            if (starIcon && await starIcon.isVisible().catch(() => false)) {
                // Make sure it's not in the sidebar
                const inSidebar = await starIcon.evaluate(el =>
                    el.closest('[class*="Sidebar"]') || el.closest('[class*="sidebar"]')
                );
                if (!inSidebar) {
                    log(`Found star/plus icon via: ${sel}`);
                    break;
                }
            }
            starIcon = null;
        }

        if (!starIcon) {
            // Broader fallback: find any visible plus-bold icon not in sidebar
            log('Falling back to scanning all plus-bold icons...');
            const allIcons = await page.$$('[data-icon="plus-bold"]');
            for (const icon of allIcons) {
                const inSidebar = await icon.evaluate(el =>
                    el.closest('[class*="Sidebar"]') || el.closest('[class*="sidebar"]')
                );
                if (!inSidebar && await icon.isVisible().catch(() => false)) {
                    starIcon = icon;
                    log('Found star/plus icon via full scan');
                    break;
                }
            }
        }

        if (!starIcon) {
            log('WARNING: No star/bookmark button found in search results');
            await page.screenshot({ path: path.join(__dirname, `debug_${profile.name}_no_star.png`) }).catch(() => null);
            return;
        }

        const parentButton = await starIcon.evaluateHandle(el => el.closest('button') || el);
        await parentButton.click({ force: true });
        log('Clicked star/bookmark on first result — music favorited');

        await page.waitForTimeout(2000);

        log('Favorite music flow completed');
    } catch (err) {
        log(`Favorite music error: ${err.message}`);
        throw err;
    } finally {
        addingFavoriteMusicProfiles.delete(profileId);
        await browser.close().catch(() => null);
        db.prepare("UPDATE profiles SET status = 'idle' WHERE id = ?").run(profileId);
        log('Favorite music session ended, browser closed.');
    }
}
```

- [ ] **Step 3: Add the `POST /api/add-favorite-music` route**

Insert after the `addFavoriteMusic` function:

```js

app.post('/api/add-favorite-music', async (req, res) => {
    const { profileId, searchTerm } = req.body;
    if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
    if (!searchTerm || !searchTerm.trim()) return res.status(400).json({ error: 'Search term is required' });

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (runningProfiles.has(profileId) || processingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently running automation or processing a video' });
    }

    if (avatarChangingProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is currently changing avatar' });
    }

    if (addingFavoriteMusicProfiles.has(profileId)) {
        return res.status(400).json({ error: 'Profile is already adding favorite music' });
    }

    res.json({ status: 'started', profile: profile.name });

    // Run async — fire and forget
    addFavoriteMusic(profile, searchTerm.trim()).catch((err) => {
        console.error(`[${profile.name}] Add favorite music failed:`, err.message);
    });
});
```

- [ ] **Step 4: Update `PATCH /api/profiles/:id` to accept `music_search`**

At line 586, add `music_search` to the destructured fields:

Change from:
```js
const { name, video_folder, proxy, is_scheduled, auto_increment_schedule, set_music, upload_count, channel_ids, needs_render, remove_title, need_content_check } = req.body;
```

To:
```js
const { name, video_folder, proxy, is_scheduled, auto_increment_schedule, set_music, upload_count, channel_ids, needs_render, remove_title, need_content_check, music_search } = req.body;
```

Then add the update block after the `need_content_check` block (after line 665):

```js
    if (music_search !== undefined) {
        db.prepare('UPDATE profiles SET music_search = ? WHERE id = ?').run(music_search, profileId);
    }
```

- [ ] **Step 5: Start backend and verify the route is registered**

Run: `cd backend && node server.js`
Expected: No errors on startup. Server runs on port 3010.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js
git commit -m "feat: add /api/add-favorite-music endpoint with browser automation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontend — Music Search Input + ADD FAVORITES Button in ProfileCard

**Files:**
- Modify: `frontend/src/App.jsx` (ProfileCard props, ProfileCard music row, ProfileCard action buttons, App state, App handlers, getStatusColor, fetchData sync, ProfileCard render)

**Interfaces:**
- Consumes: `POST /api/add-favorite-music` (no DB read — search term is typed directly in UI)
- Produces: Music search input + ADD FAVORITES button in each ProfileCard

- [ ] **Step 1: Add music-related props to ProfileCard destructuring**

At line 67 (after `selectedAvatarPath`), add:

```jsx
  onAddFavoriteMusic,
  isAddingFavoriteMusic,
```

Updated section:
```jsx
  selectedAvatarPath,
  onAddFavoriteMusic,
  isAddingFavoriteMusic,
  groups,
```

- [ ] **Step 2: Add "Favorite Music" row in ProfileCard**

Insert after the "Avatar Image" row (after line 275 `</div>`) and before the Proxy Server section (line 277):

```jsx

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Favorite Music</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1 }}
                    placeholder="Search music to favorite..."
                    value={profile.music_search || ''}
                    onChange={(e) => onUpdateMusicSearch(profile.id, e.target.value)}
                    disabled={isAddingFavoriteMusic}
                  />
                </div>
              </div>
```

- [ ] **Step 3: Add `Search` icon to lucide-react import**

At line 24 (import from lucide-react), add `Search`:

```jsx
  Search
```

After `Music,`:
```jsx
  Music,
  Search,
  ChevronDown,
```

- [ ] **Step 4: Add ADD FAVORITES button in action buttons row**

Insert after the CHANGE AVATAR button (after line 602 `</button>`):

```jsx

                  {/* Add Favorite Music Button */}
                  <button
                    className="btn"
                    onClick={() => onAddFavoriteMusic(profile.id, profile.music_search || '')}
                    disabled={
                      profile.status === 'uploading' ||
                      !profile.music_search ||
                      !profile.music_search.trim() ||
                      isAddingFavoriteMusic
                    }
                    title={
                      !profile.music_search || !profile.music_search.trim()
                        ? 'Enter a search term first'
                        : isAddingFavoriteMusic
                        ? 'Adding favorite music...'
                        : 'Search and favorite a TikTok sound'
                    }
                    style={{
                      background: isAddingFavoriteMusic
                        ? 'rgba(168, 85, 247, 0.12)'
                        : 'rgba(168, 85, 247, 0.08)',
                      color: isAddingFavoriteMusic ? '#A855F7' : '#C084FC',
                      border: '1px solid rgba(168,85,247,0.25)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      gap: '6px',
                      fontWeight: '700',
                      transition: 'all 0.2s',
                      cursor: (profile.status === 'uploading' || !profile.music_search || !profile.music_search.trim())
                        ? 'not-allowed'
                        : 'pointer'
                    }}
                  >
                    {isAddingFavoriteMusic ? (
                      <RefreshCw size={14} className="animate-pulse" />
                    ) : (
                      <Music size={14} />
                    )}
                    FAVORITES
                  </button>
```

- [ ] **Step 5: Add App state variable for `addingFavoriteMusicProfiles`**

At line 641 (after `const [changingAvatarProfiles, setChangingAvatarProfiles] = useState(() => new Set());`), add:

```jsx
  const [addingFavoriteMusicProfiles, setAddingFavoriteMusicProfiles] = useState(() => new Set());
```

- [ ] **Step 6: Add `handleAddFavoriteMusic` function**

Insert after `handleChangeAvatar` function (after line 1352):

```jsx

  const handleAddFavoriteMusic = async (profileId, searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) {
      setMessage({ type: 'error', text: 'Please enter a search term' });
      return;
    }
    try {
      setAddingFavoriteMusicProfiles(prev => new Set([...prev, profileId]));
      await axios.post('/api/add-favorite-music', { profileId, searchTerm: searchTerm.trim() });
      setMessage({ type: 'success', text: 'Adding favorite music! Browser will open shortly.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setAddingFavoriteMusicProfiles(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add favorite music' });
    }
  };
```

- [ ] **Step 7: Add `updateProfileMusicSearch` handler (debounced PATCH to backend)**

Insert after `handleAddFavoriteMusic`:

```jsx

  const updateProfileMusicSearch = async (id, value) => {
    try {
      await axios.patch(`/api/profiles/${id}`, { music_search: value });
    } catch (err) {
      console.error('Failed to update music_search:', err);
    }
  };
```

- [ ] **Step 8: Update `getStatusColor` to handle `adding_favorite_music` status**

At line 1359 (after `case 'changing_avatar': return '#3B82F6';`), add:

```jsx
      case 'adding_favorite_music': return '#A855F7';
```

- [ ] **Step 9: Add `addingFavoriteMusicProfiles` sync to `fetchData`**

At line 724 (after the `changingAvatarProfiles` sync block in `fetchData`), add:

```jsx

      // Sync adding favorite music status from profile status field
      setAddingFavoriteMusicProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'adding_favorite_music') next.add(p.id);
          else next.delete(p.id);
        });
        return next;
      });
```

- [ ] **Step 10: Pass new props to ProfileCard render**

At line 1687 (after `selectedAvatarPath={avatarSelections[profile.id] || ''}`), add these new props:

```jsx
                      onAddFavoriteMusic={handleAddFavoriteMusic}
                      isAddingFavoriteMusic={addingFavoriteMusicProfiles.has(profile.id)}
                      onUpdateMusicSearch={updateProfileMusicSearch}
```

- [ ] **Step 11: Also update ProfileCard to accept `onUpdateMusicSearch` prop**

At line 67, also add `onUpdateMusicSearch` to the destructured props:

The updated destructured section (after `isAddingFavoriteMusic,`):
```jsx
  onUpdateMusicSearch,
  groups,
```

- [ ] **Step 12: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add favorite music search input and ADD FAVORITES button to profile cards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Integration Test — End-to-End Verification

**Files:**
- None (manual verification)

- [ ] **Step 1: Start both backend and frontend**

```bash
cd backend && node server.js &
cd frontend && npm run dev
```

- [ ] **Step 2: Verify ProfileCard shows Favorite Music row**

Open browser at `http://localhost:3009`.
Expected: Each expanded ProfileCard shows "Favorite Music" row with text input + ADD FAVORITES button after the Avatar Image row.

- [ ] **Step 3: Test input persistence**

Type a search term into the "Favorite Music" input.
Expected: Value persists after page refresh (saved via PATCH to backend).

- [ ] **Step 4: Verify ADD FAVORITES button states**

- Button is disabled when input is empty
- Button is enabled when search term is entered
- Button shows purple styling with Music icon

- [ ] **Step 5: Test full flow (manual)**

1. Enter a search term (e.g., "lofi beats") for a profile with a logged-in TikTok session
2. Click ADD FAVORITES
Expected: Message "Adding favorite music! Browser will open shortly.", browser opens to upload page, Sounds panel opens, search term is typed, star clicked on first result, browser closes.

- [ ] **Step 6: Test error cases**

- Click ADD FAVORITES without a search term → error message
- Click ADD FAVORITES while profile is uploading → button disabled
- Click ADD FAVORITES while already adding → 400 error

- [ ] **Step 7: Commit any fixes**

Only if issues found and fixed.
