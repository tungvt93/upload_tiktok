#!/usr/bin/env bash
# Khởi động frontend (Vite), backend (Express) và video_download_api (FastAPI) cùng lúc.
# Cách dùng: ./start-all.sh   hoặc   bash start-all.sh
# Dừng: Ctrl+C

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
API_PORT="${VIDEO_DOWNLOAD_API_PORT:-8000}"
export VIDEO_CMS_BASE_URL="${VIDEO_CMS_BASE_URL:-http://localhost:8001}"
export VIDEO_DOWNLOAD_API_BASE_URL="${VIDEO_DOWNLOAD_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"

PIDS=()

cleanup() {
  echo ""
  echo "Đang dừng các service..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "Đã dừng."
}

trap cleanup EXIT INT TERM

for cmd in node npm "$PYTHON"; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Thiếu lệnh: $cmd (cài Node.js / Python và thử lại)"
    exit 1
  }
 done

echo "Khởi động backend (http://127.0.0.1:3001)..."
(cd "$ROOT/backend" && node server.js) &
PIDS+=($!)

echo "Khởi động frontend Vite (http://127.0.0.1:3000)..."
(cd "$ROOT/frontend" && npm run dev) &
PIDS+=($!)

echo "Khởi động video_download_api (http://127.0.0.1:${API_PORT})..."
(cd "$ROOT/video_download_api" && "$PYTHON" -m uvicorn main:app --reload --host 127.0.0.1 --port "$API_PORT") &
PIDS+=($!)

echo ""
echo "Các PID: ${PIDS[*]}"
echo "- Frontend:    http://127.0.0.1:3000"
echo "- Backend:     http://127.0.0.1:3001  (Vite proxy /api → backend)"
echo "- Download API: http://127.0.0.1:${API_PORT}/docs"
echo ""
echo "Nhấn Ctrl+C để tắt cả ba."

wait
