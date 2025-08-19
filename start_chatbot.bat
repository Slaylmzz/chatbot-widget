@echo off
setlocal

REM Calisma dizinini bu dosyanin bulundugu klasore ayarla
cd /d "%~dp0"

echo [1/2] Backend sunucusu baslatiliyor...
start "Chatbot Server" cmd /k "python chatbot_server.py"

echo [2/2] Arayuz aciliyor...
REM Sunucunun ayaga kalkmasi icin kisa bir bekleme
timeout /t 2 /nobreak >nul
start "" "%~dp0chatbot-with-product-verification.html"

echo Hepsi hazir. Bu pencereyi kapatabilirsiniz.
exit /b 0 