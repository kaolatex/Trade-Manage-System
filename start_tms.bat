@echo off
chcp 65001 >nul
title Trade Manage System (TMS) Launcher
echo ====================================================================
echo   🚀 Starting Trade Manage System (TMS)
echo   MT5 Python Cloud Sync Bridge + Next.js Web Dashboard
echo ====================================================================
echo.

:: 1. Start Python Sync Bridge in background window
echo [1/3] Launching Python MT5 Cloud Sync Bridge (Port 8000)...
start "TMS MT5 Sync Bridge" cmd /k "cd /d "%~dp0tms-bot" && python sync_service.py"

:: Wait 3 seconds for bridge startup
timeout /t 3 /nobreak >nul

:: 2. Start Web Frontend in background window
echo [2/3] Launching Next.js Web Dashboard (Port 3000)...
start "TMS Web Dashboard" cmd /k "cd /d "%~dp0tms-web" && npm run dev"

:: Wait 3 seconds for dev server
timeout /t 3 /nobreak >nul

:: 3. Open browser
echo [3/3] Opening Dashboard in browser...
start http://localhost:3000

echo.
echo ====================================================================
echo   ✅ All TMS Services Started!
echo   - Local Bridge: http://localhost:8000
echo   - Web Dashboard: http://localhost:3000
echo ====================================================================
timeout /t 5
