@echo off
title SERVICE HUB - Port 5000
color 0B
echo.
echo ========================================
echo    SERVICE HUB - CENTRALIZED AUTH
echo ========================================
echo.
echo Starting Service Hub on port 5000...
echo.
echo IMPORTANT: Keep this window OPEN!
echo Service Hub must run for login to work.
echo.
echo ========================================
echo.

cd /d "C:\Users\user\Downloads\service-hub"
call npm run dev

pause
