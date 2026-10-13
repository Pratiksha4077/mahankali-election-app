@echo off
title Mahankali Admin App (Port 8081)
color 0E
echo ========================================================
echo   MAHANKALI ELECTION SYSTEM - ADMIN APPLICATION
echo   Starting Admin Expo Dev Server on Port 8081...
echo ========================================================
echo.
echo   [+] Features: Users, Data Upload, Reports, Audit Logs
echo   [+] Package:  com.mahankali.admin
echo   [+] Backend:  Connected to shared FastAPI & MongoDB
echo.
cd /d "%~dp0admin-app"
npx expo start --port 8081
pause
