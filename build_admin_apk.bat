@echo off
title Build Admin APK - Mahankali Election
color 0E
echo ========================================================
echo   BUILDING MAHANKALI ADMIN APK FILE
echo   Target Package: com.mahankali.admin
echo ========================================================
echo.
cd /d "%~dp0admin-app"
npx eas-cli build -p android --profile preview
pause
