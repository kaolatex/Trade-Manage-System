@echo off
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%LOCALAPPDATA%\Programs\MinGit\mingw64\bin;%PATH%"
cd /d "%~dp0"

echo ====================================================================
echo  TradeManageSystem (TMS) -- Pushing to GitHub
echo ====================================================================
echo.
git push -u origin main

echo.
pause
