# Add Favorite Music Feature Design

**Date:** 2026-06-22
**Status:** Approved

## Overview

Add ability to favorite a TikTok music/sound by search term via browser automation. Each profile has a text input for the search query and an "ADD FAVORITES" button. When clicked, opens the upload page, opens the Sounds panel, searches for the music, and clicks the star/bookmark button on the first result.

## Flow

1. User enters a search term in the "Favorite Music" input per profile
2. User clicks "ADD FAVORITES" button
3. Backend launches persistent browser context (reusing cookies/session)
4. Navigates to `tiktok.com/tiktokstudio/upload`
5. Waits for upload page to load, clicks "Sounds" button (`button[data-button-name="sounds"]`)
6. In the Sounds panel, types the search term into the search input
7. Waits for search results, clicks the star/bookmark icon on the first result
8. Closes browser

## Components

### Database Migration
- Add column `music_search TEXT` to `profiles` table

### Backend API

**`POST /api/add-favorite-music`**
- Input: `{ profileId, searchTerm }`
- Uses same persistent browser context pattern
- Navigates to TikTok upload page, opens Sounds panel
- Searches by typing `searchTerm` into search input
- Clicks star/bookmark on first result
- Tracks state via `addingFavoriteMusic` Set (prevents concurrent operations)

### Frontend UI

**ProfileCard additions:**
- "Favorite Music" row: text input + "ADD FAVORITES" button
- Button disabled when uploading or no search term entered

**App state additions:**
- `addingFavoriteMusicProfiles` Set — tracks which profiles are currently adding favorite music
- `handleAddFavoriteMusic(profileId, searchTerm)` — calls `POST /api/add-favorite-music`

## Browser Automation Detail

1. Launch persistent Chromium context at `profiles/<name>/`
2. Navigate to `https://www.tiktok.com/tiktokstudio/upload`
3. Wait for upload page elements (`button[data-button-name="sounds"]`)
4. Click Sounds button
5. Wait for Sounds panel to open
6. Find search input in the Sounds panel
7. Type search term
8. Wait for search results
9. Find and click star/bookmark icon on first result
10. Close browser

## Error Handling

- No search term → 400 with message
- Profile not found → 404
- Profile running another operation → 400
- Sounds button not found → error log, close browser
- Search input not found → error log, close browser
- No search results → warning log, close browser
- Star button not found on results → error log, close browser
