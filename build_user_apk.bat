@echo off
title Build User APK - Mahankali Election
color 0B
echo ========================================================
echo   BUILDING MAHANKALI USER APK FILE
echo   Target Package: com.mahankali.voters
echo ========================================================
echo.
if not defined SYSTEMROOT set "SYSTEMROOT=C:\Windows"
if not defined SystemRoot set "SystemRoot=C:\Windows"
cd /d "%~dp0user-app"
where eas >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    eas build -p android --profile preview
) else (
    npx eas-cli build -p android --profile preview
)
pause
