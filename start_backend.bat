@echo off
title Election App - Backend Server (MongoDB & FastAPI)
color 0A
echo ======================================================================
echo          MAHANKALI VOTER MANAGEMENT SYSTEM - BACKEND SERVER
echo ======================================================================
echo.
echo   [+] Local Dev Server: http://localhost:8000
echo   [+] Local API URL:    http://localhost:8000/api
echo   [+] Swagger Docs:     http://localhost:8000/docs
echo.
echo   [+] PRODUCTION API:   https://election-api.onrender.com/api
echo   [+] (Render deploy झाल्यावर वरील URL APK मध्ये वापरा)
echo.
echo   [+] Default Logins:
echo       1) Admin Login:  username: admin      password: admin123
echo       2) User Login:   username: pratiksha  password: user123
echo       3) User Login:   username: user       password: user123
echo.
echo   [!] IMPORTANT:
echo       * Local backend फक्त development साठी वापरा.
echo       * Production APK साठी Render वर deploy केलेला backend वापरा.
echo       * MongoDB Atlas connection string .env मध्ये set करा.
echo ======================================================================
echo.
cd /d "%~dp0backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
