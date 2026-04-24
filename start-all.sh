#!/usr/bin/env bash
# Khởi động frontend (Vite), backend (Express) và video_download_api (FastAPI trong Docker) cùng lúc.
# Cách dùng: ./start-all.sh   hoặc   bash start-all.sh
# Dừng: Ctrl+C
#
# Cổng API Docker: VIDEO_DOWNLOAD_API_PORT (mặc định 8000), phải khớp docker-compose.yml.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

API_PORT="${VIDEO_DOWNLOAD_API_PORT:-8000}"
export VIDEO_DOWNLOAD_API_PORT="$API_PORT"
export VIDEO_CMS_BASE_URL="${VIDEO_CMS_BASE_URL:-http://localhost:8001}"
export VIDEO_DOWNLOAD_API_BASE_URL="${VIDEO_DOWNLOAD_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
# Backend map đường dẫn uploads host ↔ container (khớp docker-compose mount ../uploads:/data/uploads)
export VIDEO_DOWNLOAD_API_DOCKER_UPLOADS_MOUNT="${VIDEO_DOWNLOAD_API_DOCKER_UPLOADS_MOUNT:-/data/uploads}"

PIDS=()
STARTED_VIDEO_DOCKER=0

cleanup() {
  echo ""
  echo "Đang dừng các service..."
  if [[ "$STARTED_VIDEO_DOCKER" -eq 1 ]]; then
    echo "Đang dừng video_download_api (Docker)..."
    (cd "$ROOT/video_download_api" && docker compose down) || true
  fi
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "Đã dừng."
}

trap cleanup EXIT INT TERM

for cmd in node npm docker; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Thiếu lệnh: $cmd (cài Node.js / Docker và thử lại)"
    exit 1
  }
done
docker compose version >/dev/null 2>&1 || {
  echo "Thiếu Docker Compose (plugin: \`docker compose\`). Cài Docker Desktop / docker-compose-plugin và thử lại."
  exit 1
}

echo "Khởi động backend (http://127.0.0.1:3001)..."
(cd "$ROOT/backend" && node server.js) &
PIDS+=($!)

echo "Khởi động frontend Vite (http://127.0.0.1:3000)..."
(cd "$ROOT/frontend" && npm run dev) &
PIDS+=($!)

echo "Khởi động video_download_api (Docker → http://127.0.0.1:${API_PORT})..."
(cd "$ROOT/video_download_api" && docker compose up -d --build)
STARTED_VIDEO_DOCKER=1

echo ""
echo "Các PID: ${PIDS[*]}"
echo "- Frontend:    http://127.0.0.1:3000"
echo "- Backend:     http://127.0.0.1:3001  (Vite proxy /api → backend)"
echo "- Download API: http://127.0.0.1:${API_PORT}/docs"
echo ""
echo "Nhấn Ctrl+C để tắt frontend/backend và dừng stack Docker của Download API."

wait
