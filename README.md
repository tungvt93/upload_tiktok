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
