@echo off
chcp 65001 >nul
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%LOCALAPPDATA%\Programs\MinGit\mingw64\bin;%PATH%"
cd /d "%~dp0"

echo ====================================================================
echo   🚀 TradeManageSystem (TMS) -- Git Commit & Push to GitHub
echo ====================================================================
echo.

echo [1/3] Staging all files...
git add -A

echo [2/3] Committing changes...
git commit -m "feat: upgrade 3000-bar quant engine, instant smart BE, #BTCUSD support and crash-proof symbol resolver"

echo [3/3] Pushing to GitHub (origin main)...
git push -u origin main

echo.
echo ====================================================================
echo   ✅ Push complete! Vercel is now automatically deploying updates.
echo ====================================================================
echo.
pause
