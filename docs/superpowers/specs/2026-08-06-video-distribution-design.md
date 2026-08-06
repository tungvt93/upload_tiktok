# Video Distribution Feature Design

**Date:** 2026-08-06
**Status:** Approved

## Overview

Add a new "Phân Phối Video" tab to the TikTok Channel Manager that allows users to:
1. Curate a persistent list of profiles for video distribution
2. Input a source folder containing videos
3. Distribute videos from the source folder to each profile's upload folder (round-robin, fixed count per profile)
4. Source videos are moved (not copied) — deleted from source after distribution

## Database Schema

New table `distribution_profiles`:

```sql
CREATE TABLE distribution_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
```

Stores which profiles are selected for distribution. Cascade delete: when a profile is removed from the system, its distribution entry is auto-removed.

## API Endpoints

All routes prefixed with `/api/distribution`.

### GET `/api/distribution/profiles`
Get all profiles in the distribution list, joined with profiles + groups tables.

**Response:** Array of `{ id, profile_id, profile_name, group_name, video_folder, created_at }`

### POST `/api/distribution/profiles`
Add one profile to the distribution list.

**Body:** `{ profile_id: number }`
**Response:** The created record
**Error:** 409 if profile already in list

### DELETE `/api/distribution/profiles/:profileId`
Remove a profile from the distribution list (by `profile_id`, not distribution record id).

**Response:** `{ success: true }`

### POST `/api/distribution/distribute`
Execute video distribution.

**Body:** `{ sourceFolder: string, videosPerProfile: number }`

**Logic:**
1. Validate `sourceFolder` exists and is a directory
2. Validate `videosPerProfile` > 0
3. Fetch all profiles in distribution list with their `video_folder` values
4. If no profiles selected, return error
5. Scan source folder for video files (extensions: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`)
6. Calculate total needed = profileCount × videosPerProfile
7. Round-robin distribution: iterate through videos, assign to profiles in order (0, 1, 2, ..., 0, 1, 2, ...)
8. For each assignment: `fs.renameSync(sourceFile, destFile)` — move file to profile's video_folder
9. Create destination folder if it doesn't exist
10. Stop when source folder runs out of videos OR all profiles have received their quota
11. Return result summary

**Response:**
```json
{
  "profiles": [
    { "profileId": 1, "profileName": "test", "count": 5, "folder": "/uploads/test/" }
  ],
  "totalDistributed": 14,
  "totalExpected": 15,
  "missing": 1
}
```

## Frontend

### Navigation

New tab `'distribution'` added to the activeTab state alongside `'profiles'`, `'groups'`, `'settings'`. Tab label: "Phân Phối Video" with a `Share2` or `Video` icon from Lucide.

### Main Screen (Distribution Tab)

**Layout:**
- Header row: title "Phân Phối Video" + "Thêm Profile" button (primary)
- Profile grid: cards showing selected profiles
  - Each card: profile name, group badge, video folder path (truncated), remove button (🗑️)
  - Empty state: "Chưa có profile nào được chọn" with prompt to add
- Action bar at bottom: "Phân Phối Video" button (disabled if no profiles selected, full-width, prominent)

### Modal: "Thêm Profile" (`showAddProfileModal`)

- Group filter dropdown (populated from `/api/groups`) with "Tất cả" option
- Scrollable list of profiles NOT already in distribution
  - Each row: checkbox, profile name, group badge
- Action buttons: "Thêm" (primary), "Huỷ" (secondary)
- On submit: POST to `/api/distribution/profiles` for each selected profile

### Modal: "Phân Phối Video" (`showDistributeModal`)

- Input: Source folder path (text input, placeholder: "/path/to/videos")
  - Could add a "Browse" button using `/api/select-folder` later
- Input: Videos per profile (number, min=1, default=1)
- Summary line: "3 profile × 5 video = 15 video cần phân phối" (updates live)
- Submit button: "Phân Phối" with loading state
- Result display (after distribution completes):
  - Success: green check + summary (e.g., "Đã phân phối 14/15 video. Thiếu 1 video cho profile X.")
  - Partial: yellow warning if source ran out before quota met
  - Error: red if folder doesn't exist or other error

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Source folder doesn't exist | Return 400 with error message |
| Source folder has no videos | Return 400 "Folder không chứa video" |
| No profiles in distribution list | Return 400 "Chưa chọn profile" |
| Profile's video_folder doesn't exist | Auto-create via `fs.mkdirSync({ recursive: true })` |
| Source runs out before quota met | Partial success, report missing count per profile |
| File move fails (permissions, disk full) | Log error, skip file, continue with next, report failures |

## Files to Modify

| File | Changes |
|------|---------|
| `backend/server.js` | Add 4 API routes, init `distribution_profiles` table on startup |
| `frontend/src/App.jsx` | Add `'distribution'` tab, main screen UI, 2 modals, state management |
| `frontend/src/index.css` | Minor CSS additions if needed (likely reuse existing classes) |

## Design System Consistency

- Reuse existing modal pattern: `AnimatePresence` + `motion.div` glassmorphism overlay
- Reuse `.glass`, `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.input` CSS classes
- Reuse `ProfileCard`-like card style for distribution profile cards
- Follow existing 5-second polling pattern (poll distribution profiles list)
- Lucide icons: `Share2`, `Video`, `FolderOpen`, `Trash2`, `Plus`
