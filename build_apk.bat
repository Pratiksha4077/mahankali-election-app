@echo off
title Build Election Apps APK
echo ========================================================
echo        MAHANKALI ELECTION SYSTEM - BUILD APK
echo ========================================================
echo.
echo   [1] Build Admin APK (com.mahankali.admin)
echo   [2] Build User APK  (com.mahankali.voters)
echo   [3] Exit
echo.
set /p choice="Enter your choice [1, 2, or 3]: "

if "%choice%"=="1" (
    call "%~dp0build_admin_apk.bat"
) else if "%choice%"=="2" (
    call "%~dp0build_user_apk.bat"
) else (
    echo Exiting...
)
