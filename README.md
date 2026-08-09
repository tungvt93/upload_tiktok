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

## 📂 Cấu trúc thư mục
- `/backend`: Mã nguồn server Node.js và Playwright automation.
- `/frontend`: Mã nguồn giao diện React (Vite).
- `/data`: Chứa cơ sở dữ liệu SQLite.
- `/profiles`: Chứa dữ liệu trình duyệt của từng profile TikTok.
- `/uploads`: Thư mục chứa video để tải lên.

## 📝 Lưu ý
- Đảm bảo các video được đặt đúng định dạng `.mp4` hoặc `.mov` trong thư mục profile tương ứng.
- Cấu hình Proxy nếu cần thiết trong giao diện quản lý profile.

---

## 📥 Douyin Downloader — Authenticated Requests

The Douyin Downloader (`backend/douyin-client.js` + `/api/douyin`) now makes
**authenticated** requests using browser cookies to bypass anti-bot protection.

### 1. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

```dotenv
# Browser cookies from a logged-in Douyin session (required key: sessionid)
DOUYIN_COOKIES=sessionid=xxx;ttwid=xxx;msToken=xxx

# Optional proxy
HTTP_PROXY=http://user:pass@host:port
HTTPS_PROXY=http://user:pass@host:port

# Fail fast when the cookie is missing/invalid (recommended for production)
DOUYIN_REQUIRE_COOKIE=1
```

> **How to get `DOUYIN_COOKIES`:** log in at <https://www.douyin.com/>, open
> DevTools → **Application → Cookies**, and copy the `sessionid`, `ttwid` and
> `msToken` values. Supported formats: `"name=value; name2=value2"` or a JSON
> array `[{"name":"...","value":"..."}]`. The minimum required key is
> `sessionid`; `ttwid` and `msToken` are recommended.

### 2. How it works

- [`backend/config/douyin.config.js`](backend/config/douyin.config.js) — central
  config module (plain-JS equivalent of a NestJS `ConfigModule`) that reads and
  validates the environment variables and auto-loads a `.env` file.
- [`backend/douyin-http-client.js`](backend/douyin-http-client.js) — reusable
  `DouyinHttpClient` service that injects cookies + browser headers, supports
  proxies, and handles timeouts, retries and rate limiting.
- [`backend/douyin-errors.js`](backend/douyin-errors.js) — typed exceptions:
  `DouyinCookieMissingException`, `DouyinAuthenticationException`,
  `DouyinRateLimitException`.
- [`backend/douyin-cookies.js`](backend/douyin-cookies.js) — cookie parsing and
  validation (empty / malformed / missing `sessionid`).

All downloader services (`douyin-client.js`) were refactored onto
`DouyinHttpClient` — the duplicated request/cookie/proxy logic was removed.

### 3. Logging (never logs cookie values)

- `cookie loaded (N cookie pairs)` — when a valid cookie is configured
- `no DOUYIN_COOKIES configured — requests will be anonymous` — warning
- `proxy enabled (protocol://host:port)` — when a proxy is configured
- `request failed (...) — retrying (n/N)` — on each retry
- `authentication failure (HTTP 401/403)` — stale/expired cookies

### 4. Tests

```bash
cd backend

# Unit tests (config, cookies, exceptions, http client)
node --test tests/douyin-config.test.js tests/douyin-http-client.test.js

# Integration tests (auth + full feature, no external network)
node tests/douyin-auth-integration.mjs
node tests/douyin-smoke.mjs
node tests/douyin-http.mjs
node tests/douyin-integration.mjs
```
