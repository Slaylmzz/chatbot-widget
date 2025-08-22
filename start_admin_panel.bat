@echo off
setlocal
title Eraco Chatbot Admin Panel
color 0A

REM Calisma dizinini bu dosyanin bulundugu klasore ayarla
cd /d "%~dp0"

echo ===============================================
echo    ERACO CHATBOT ADMIN PANEL STARTER
echo ===============================================
echo.

REM Mevcut Python sunucularini durdur
taskkill /F /IM python.exe >nul 2>&1

:: Virtual environment'i kontrol et ve aktive et
echo [1/3] Virtual environment aktif ediliyor...
if exist "%~dp0.venv\Scripts\activate.bat" (
    call "%~dp0.venv\Scripts\activate.bat"
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
) else (
    echo Virtual environment bulunamadi, sistem Python kullaniliyor...
    set "PYTHON_EXE=python"
)

echo [2/3] Gerekli kutuphaneler kontrol ediliyor...
"%PYTHON_EXE%" -c "import flask, flask_cors, sqlite3, smtplib, requests" 2>nul
if errorlevel 1 (
    echo HATA: Gerekli kutuphaneler eksik!
    echo Kutuphaneler yukleniyor...
    "%PYTHON_EXE%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Kutuphaneler yuklenemedi!
        pause
        exit /b 1
    )
)

echo [3/3] Admin panel baslatiliyor...
echo.
echo ===============================================
echo  ADMIN PANEL BILGILERI:
echo ===============================================
echo  Admin Panel URL: http://127.0.0.1:5000/admin-panel.html
echo  Chatbot URL:     http://127.0.0.1:5000/chatbot-with-product-verification.html
echo  API Base URL:    http://127.0.0.1:5000/api
echo ===============================================
echo.
echo Admin paneli otomatik olarak tarayicida acilacak...
echo Sunucuyu durdurmak icin Ctrl+C tuslayin.
echo.

:: 3 saniye bekle ve admin panelini aç
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5000/admin-panel.html"

:: Python sunucusunu başlat
"%PYTHON_EXE%" chatbot_server.py

pause
