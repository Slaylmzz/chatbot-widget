@echo off
cd /d "%~dp0"

echo ===============================================
echo    ERACO CHATBOT ADMIN PANEL STARTER
echo ===============================================
echo.

echo Mevcut Python sunucularini durduruyor...
taskkill /F /IM python.exe >nul 2>&1

echo Virtual environment kontrol ediliyor...
if exist ".venv\Scripts\python.exe" (
    echo Virtual environment bulundu.
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
    echo Sistem Python kullaniliyor.
    set "PYTHON_EXE=python"
)

echo Gerekli kutuphaneler kontrol ediliyor...
%PYTHON_EXE% -c "import flask, flask_cors, sqlite3, smtplib, requests" 2>nul
if errorlevel 1 (
    echo Gerekli kutuphaneler yukleniyor...
    %PYTHON_EXE% -m pip install -r requirements.txt
)

echo.
echo ===============================================
echo  ADMIN PANEL BILGILERI:
echo ===============================================
echo  Admin Panel URL: http://127.0.0.1:5000/admin-panel.html
echo  Chatbot URL:     http://127.0.0.1:5000/chatbot-with-product-verification.html
echo ===============================================
echo.

echo 3 saniye sonra admin panel acilacak...
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5000/admin-panel.html"

echo Python sunucusu baslatiliyor...
%PYTHON_EXE% chatbot_server.py

pause
