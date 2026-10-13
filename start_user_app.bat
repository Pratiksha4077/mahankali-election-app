@echo off
title Mahankali User App (Port 8082)
color 0B
echo ========================================================
echo   MAHANKALI ELECTION SYSTEM - USER APPLICATION
echo   Starting User Expo Dev Server on Port 8082...
echo ========================================================
echo.
echo   [+] Features: Voter Search, Families, 12 Reports, Field Sync
echo   [+] Package:  com.mahankali.voters
echo   [+] Backend:  Connected to shared FastAPI & MongoDB
echo.
cd /d "%~dp0user-app"
npx expo start --port 8082
pause
