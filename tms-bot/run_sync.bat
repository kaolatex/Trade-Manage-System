@echo off
title TMS MT5 Cloud Sync Service
cd /d "%~dp0"
echo ==============================================================================
echo   TradeManageSystem (TMS) — MT5 to Supabase Cloud Sync Bridge
echo ==============================================================================
echo Starting Python FastAPI Sync Service on http://localhost:8000 ...
python sync_service.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Notice] Python exited with code %ERRORLEVEL%.
    pause
)
