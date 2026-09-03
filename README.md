# TikTok Multi-Profile Automation System

Hệ thống quản lý nhiều profile TikTok và tự động hóa quá trình đăng video với giao diện hiện đại (Glassmorphism).

## 🚀 Tính năng chính
- Quản lý đa hồ sơ (Multi-profile) với SQLite.
- Tự động hóa đăng video bằng Playwright.
- Hỗ trợ Proxy cho từng profile.
- Giao diện Dashboard cao cấp, phản hồi nhanh.
- Lưu trữ session (không cần đăng nhập lại nhiều lần).

## 🛠 Yêu cầu hệ thống
- **Node.js**: Phiên bản 16 trở lên.
- **npm** hoặc **yarn**.
- **Trình duyệt Google Chrome** (được cài đặt sẵn hoặc thông qua Playwright).

## 📦 Cài đặt

### 1. Tải mã nguồn
```bash
git clone <url-cua-ban>
cd Code_labs
```

### 2. Cài đặt Backend
```bash
cd backend
npm install
# Cài đặt trình duyệt cho Playwright
npx playwright install chromium
```

### 3. Cài đặt Frontend
```bash
cd ../frontend
npm install
```

## 🏃‍♂️ Cách chạy ứng dụng

Bạn cần chạy cả Backend và Frontend cùng lúc.

### Bước 1: Chạy Backend
Mở một terminal mới:
```bash
cd backend
node server.js
```
*Backend sẽ chạy tại: `http://localhost:3001`*

### Bước 2: Chạy Frontend
Mở một terminal khác:
```bash
cd frontend
npm run dev
```
*Frontend sẽ chạy tại: `http://localhost:5173` (hoặc cổng được hiển thị trong terminal)*

## 📱 Clipboard Queue — Tải video từ điện thoại

Điện thoại copy link video → gọi API → backend xếp hàng và tự tải về `uploads/_inbox`. Chi tiết setup mobile (iOS Shortcuts / Android MacroDroid) xem trong app dashboard, tab **Clipboard Queue** (có sẵn endpoint + x-api-key để copy).

### Yêu cầu thêm cho tính năng này
- **yt-dlp** đã cài trong PATH (`pip install -U yt-dlp` hoặc `brew install yt-dlp`).
- **ffmpeg/ffprobe** đã cài trong PATH.
- **curl_cffi** (Python) — bắt buộc để yt-dlp impersonate browser, nếu không TikTok/Douyin sẽ chặn IP:
  ```bash
  pip3 install --user "curl_cffi>=0.10,<0.16"
  ```
  ⚠️ Chỉ dùng bản `0.5.10` hoặc `0.10.x`–`0.15.x`. Bản mới hơn (vd `0.16.x`) yt-dlp báo "unsupported", impersonate không hoạt động. Kiểm tra bằng `yt-dlp --list-impersonate-targets` — phải thấy danh sách Chrome/Safari/Firefox, không phải toàn `(unavailable)`.

### Nền tảng hỗ trợ
| Nền tảng | Cách tải | Cần setup thêm? |
|---|---|---|
| TikTok, YouTube, link `.mp4/.mov/.webm/.mkv` trực tiếp | yt-dlp | Không |
| Kuaishou (`v.kuaishou.com`, `kuaishou.com`) | Downloader riêng (parse trang mobile SSR) | Không |
| Douyin (`douyin.com`) | yt-dlp + cookie + impersonate | **Có, bắt buộc** (xem bên dưới) |
| Site khác yt-dlp hỗ trợ | yt-dlp generic | Tùy site, có thể cần cookie tương tự |

### Cookie cho Douyin (bắt buộc)

Douyin chặn mọi request không có cookie chống bot tên `s_v_web_id` — **không cần đăng nhập**, chỉ cần cookie này tồn tại (sinh ra khi trình duyệt thật vượt qua challenge JS lúc load trang). Thiếu cookie → lỗi `Fresh cookies (not necessarily logged in) are needed`.

**Cách lấy:**
1. Cài extension **"Get cookies.txt LOCALLY"** (Chrome/Edge) hoặc tương tự.
2. Mở `https://www.douyin.com` trong trình duyệt đó — không cần đăng nhập, chỉ cần load trang xong.
3. Bấm extension → Export cookies cho domain `douyin.com` → tải file `.txt`.
4. Mở file `.txt` đó, copy toàn bộ các dòng bắt đầu bằng `.douyin.com` / `www.douyin.com` (bỏ qua 2 dòng header `# Netscape HTTP Cookie File`).
5. **Append** (thêm vào cuối, không xóa nội dung cũ) các dòng đó vào `backend/cookies.txt` — file này dùng chung cho cả YouTube lẫn Douyin; yt-dlp tự lọc cookie theo domain nên không xung đột nhau.

**Lưu ý:**
- Cookie là session cookie, **sẽ hết hạn** (thường vài tuần–vài tháng). Thấy lỗi `Fresh cookies needed` quay lại → lặp lại 5 bước trên.
- Dù có cookie + impersonate đúng, Douyin vẫn có xác suất chặn ngẫu nhiên (anti-bot phía họ, không phải lỗi cấu hình). Backend đã tự retry 3 lần; nếu vẫn fail, bấm **Retry** thủ công trên dashboard.
- File `backend/cookies.txt` chứa thông tin nhạy cảm (session cookie) — không commit lên git công khai, không chia sẻ.

## 📂 Cấu trúc thư mục
- `/backend`: Mã nguồn server Node.js và Playwright automation.
- `/frontend`: Mã nguồn giao diện React (Vite).
- `/data`: Chứa cơ sở dữ liệu SQLite.
- `/profiles`: Chứa dữ liệu trình duyệt của từng profile TikTok.
- `/uploads`: Thư mục chứa video để tải lên.

## 📝 Lưu ý
- Đảm bảo các video được đặt đúng định dạng `.mp4` hoặc `.mov` trong thư mục profile tương ứng.
- Cấu hình Proxy nếu cần thiết trong giao diện quản lý profile.
