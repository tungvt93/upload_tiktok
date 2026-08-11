# TikTok Video Statistics Feature — Design Spec
Date: 2026-08-11

## Overview

Tính năng thống kê video theo profile: chọn nhiều profile, tự động mở browser, crawl TikTok Studio content page, kiểm tra từng video có bị restricted không, xuất file Excel.

## UI & User Flow

### Toolbar change
- Xóa nút "Engage đã chọn" khỏi toolbar trong `ProfilesView.jsx`
- Thêm nút **"Thống kê"** (icon: BarChart2 từ lucide-react) ở đúng vị trí đó
- Nút chỉ active khi `selectedForRun.size > 0`

### Flow
1. User tick chọn ≥1 profile → click "Thống kê"
2. `StatsModal` mở ra, gọi `POST /api/stats/start` với `{ profileIds }`
3. Modal mở SSE stream `GET /api/stats/stream/:jobId`, hiển thị realtime:
   - Progress bar / text: `Profile A: 3/12 videos... Profile B: đang mở...`
   - Log từng video được xử lý xong
4. Khi tất cả profile xong → nút **Download Excel** active
5. Click Download → `GET /api/stats/download/:jobId` → file về máy
6. Nút **Hủy** gọi `DELETE /api/stats/cancel/:jobId`, đóng modal

### Excel output
- Tên file: `tiktok_stats_YYYY-MM-DD.xlsx`
- Mỗi profile = 1 sheet (tên sheet = tên profile)
- Cột: `STT | Ngày upload | Views | Restricted`
- Ô Restricted bị restricted: background đỏ (#FF0000), text "RED"
- Ô Restricted bình thường: để trống

## Backend Architecture

### API Endpoints
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/stats/start` | Khởi động job, trả về `{ jobId }` |
| GET | `/api/stats/stream/:jobId` | SSE stream events |
| GET | `/api/stats/download/:jobId` | Download file Excel |
| DELETE | `/api/stats/cancel/:jobId` | Hủy job |

### SSE Event types
```json
{ "type": "progress", "profileId": "xxx", "profileName": "A", "done": 3, "total": 12 }
{ "type": "video", "profileId": "xxx", "title": "tiktok", "date": "7/13/2026", "views": 54, "restricted": true }
{ "type": "done", "profileId": "xxx" }
{ "type": "all_done" }
{ "type": "error", "profileId": "xxx", "message": "..." }
```

### Playwright automation (mỗi profile)
**Phase 1 — Scrape content list:**
1. Mở browser với profile data directory (giống pattern hiện tại)
2. Vào `https://www.tiktok.com/tiktokstudio/content`
3. Đợi danh sách video load, scroll để load hết
4. Scrape từng row: lấy ngày upload + views, lưu thành array có thứ tự

**Phase 2 — Kiểm tra restriction từng video:**
5. Click `[data-icon="ChartRise"]` của video đầu tiên → mở analytics
6. Đợi trang analytics load
7. Kiểm tra có text `"Your video is not eligible for recommendation in the For You feed"` không
8. Push SSE event `video` với kết quả
9. Click thumbnail video tiếp theo trong **panel danh sách bên trái** của màn hình analytics
10. Lặp bước 6–9 cho đến hết tất cả video trong panel

### Concurrency
- 2 profile chạy song song (`Promise.allSettled` với batch size 2)
- Các profile còn lại xếp hàng chờ

### Job store
- `Map` trong memory: `jobId → { status, results, abortController }`
- Tự xóa sau 30 phút
- Không persist vào DB

## Files

### New files
- `backend/stats-automation.mjs` — Playwright crawl logic
- `backend/stats-store.js` — Job Map management
- `frontend/src/components/StatsModal.jsx` — Modal UI

### Modified files
- `backend/server.js` — thêm 4 route `/api/stats/*`
- `frontend/src/components/ProfilesView.jsx` — thay nút Engage bằng nút Thống kê
- `frontend/src/App.jsx` — thêm state: `isStatsModalOpen`, `statsJobId`

## Dependencies
- `xlsx` npm package (backend only) — tạo Excel với cell styling
