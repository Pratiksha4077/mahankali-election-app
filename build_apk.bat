@echo off
title Election App - Build Android APK
echo ========================================================
echo   Building Android APK File using EAS CLI
echo ========================================================
cd /d "%~dp0frontend"
npx eas-cli build -p android --profile preview
pause
