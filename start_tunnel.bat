@echo off
title Election App - Public 5G/4G Mobile Tunnel
color 0B
echo ======================================================================
echo    MAHANKALI VOTER SYSTEM - PUBLIC TUNNEL FOR 5G/4G CELLULAR PHONES
echo ======================================================================
echo.
echo   [!] Use this when your mobile phone is using 5G/4G Mobile Data
echo       and NOT connected to your home/office Wi-Fi.
echo.
echo   1. Ensure "start_backend.bat" is already running in another window!
echo   2. A public URL will appear below (e.g. https://xxxx.loca.lt).
echo   3. Open the Mobile App on your phone, click "सर्व्हर", and enter:
echo      https://xxxx.loca.lt/api
echo.
echo ======================================================================
echo.
npx -y localtunnel --port 8000
pause
