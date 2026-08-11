# Avatar Change Feature Design

**Date:** 2026-06-19
**Status:** Approved

## Overview

Add ability to change a TikTok profile's avatar via browser automation. Each profile selects its own avatar image file; clicking "Change Avatar" opens the profile's browser session and automates the TikTok web UI to upload and set the new avatar.

## Flow

1. User selects an image file per profile via native OS file picker
2. User clicks "CHANGE AVATAR" button on the profile card
3. Backend launches persistent browser context (reusing existing cookies/session)
4. Navigates to TikTok profile edit page
5. Clicks avatar area, uploads the selected image via file input
6. Clicks save/confirm, closes browser
7. Returns success/failure status

## Components

### Database Migration
- Add column `avatar_image TEXT` to `profiles` table

### Backend API

**`POST /api/select-image-file`**
- Opens native OS file picker filtered to image files (png, jpg, jpeg)
- Returns `{ path: "/path/to/image.png" }`
- macOS: `osascript` with `choose file` + image type filter
- Windows: `powershell` with file dialog

**`POST /api/change-avatar`**
- Input: `{ profileId }`
- Uses same persistent browser context pattern as `/api/open-profile`
- Navigates to TikTok, opens profile edit/avatar upload flow
- Attaches the selected image file
- Confirms save
- Tracks state via `avatarChangingProfiles` Map (prevents concurrent operations)
- Updates profile status to `changing_avatar` during operation

### Frontend UI

**ProfileCard additions:**
- Avatar image file picker row: text input showing selected path + "Browse" button
- "CHANGE AVATAR" action button in the action buttons row (alongside OPEN, START, ENGAGE, LOGIN)

**App state additions:**
- `selectingAvatarFor` state — shows loading overlay during native file picker
- `changingAvatarProfiles` Set — tracks which profiles are currently changing avatar
- `handleSelectAvatar(profileId)` — triggers native file picker, then updates profile via PATCH
- `handleChangeAvatar(profileId)` — calls `POST /api/change-avatar`

## Browser Automation Detail

The avatar change automation (`changeAvatar` function in server.js):

1. Launch persistent Chromium context at `profiles/<name>/` (same as login/upload)
2. Navigate to `https://www.tiktok.com/` (checks login state)
3. Navigate to profile page or edit profile URL
4. Click on the avatar area to trigger the upload dialog
5. Locate `<input type="file">` on the TikTok page
6. Attach the image file via `setInputFiles()`
7. Wait for upload to complete
8. Click save/confirm button
9. Wait for confirmation, close browser

If the profile is not logged in, the automation will fail with a clear error message prompting the user to login first.

## Error Handling

- Profile not found → 404
- No avatar image configured → 400 with message
- Avatar file not found on disk → 400 with message
- Profile currently running another operation → 400 (prevents conflict)
- Browser automation failure → 500 with error details
- Not logged in → error message suggesting to run LOGIN first
