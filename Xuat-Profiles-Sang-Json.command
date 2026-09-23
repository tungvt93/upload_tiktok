#!/bin/bash

# Chuyển về thư mục chứa script
cd "$(dirname "$0")"

echo "===================================================="
echo "  CÔNG CỤ XUẤT PROFILES TIKTOK SANG DỰ ÁN MỚI (macOS)"
echo "===================================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
    echo "❌ Không tìm thấy Node.js trên máy!"
    echo "👉 Vui lòng cài đặt Node.js từ https://nodejs.org"
    echo ""
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi

node export_profiles.js

echo ""
read -n 1 -s -r -p "Nhấn phím bất kỳ để đóng cửa sổ..."
echo ""
