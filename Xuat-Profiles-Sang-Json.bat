@echo off
chcp 65001 >nul
title Xuất Profiles và Cookies TikTok sang JSON

echo ====================================================
echo   CÔNG CỤ XUẤT PROFILES TIKTOK SANG DỰ ÁN MỚI
echo ====================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tai: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Dang tien hanh trich xuat du lieu profiles va cookies...
echo.
node export_profiles.js

echo.
pause
