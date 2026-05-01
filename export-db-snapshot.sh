#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="${1:-$ROOT_DIR/data/tiktok.db}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Thiếu sqlite3. Hãy cài SQLite CLI rồi thử lại."
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "Không tìm thấy database: $DB_PATH"
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
snapshot_path="$ROOT_DIR/data/tiktok.snapshot.${timestamp}.db"

echo "Tạo snapshot từ: $DB_PATH"
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(FULL); VACUUM INTO '$snapshot_path';"

integrity="$(sqlite3 "$snapshot_path" "PRAGMA integrity_check;" || true)"
if [[ "$integrity" != "ok" ]]; then
  echo "Snapshot lỗi integrity_check: $integrity"
  exit 1
fi

echo "Snapshot OK: $snapshot_path"
echo "Bạn có thể commit file snapshot này để chia sẻ an toàn."
