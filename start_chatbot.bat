@echo off
setlocal

REM Calisma dizinini bu dosyanin bulundugu klasore ayarla
cd /d "%~dp0"

echo Chatbot baslatiliyor...

REM Mevcut Python sunucularini durdur
taskkill /F /IM python.exe >nul 2>&1

REM Virtual environment'i kontrol et ve aktive et
if exist "%~dp0.venv\Scripts\activate.bat" (
    echo Virtual environment aktive ediliyor...
    call "%~dp0.venv\Scripts\activate.bat"
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
) else (
    echo Virtual environment bulunamadi, sistem Python kullaniliyor...
    set "PYTHON_EXE=python"
)

REM Gerekli modulleri yukle
echo Gerekli moduller kontrol ediliyor...
"%PYTHON_EXE%" -m pip install flask flask-cors requests openai >nul 2>&1

REM OpenAI ayarlari
if exist "%~dp0openai.key" (
  set /p OPENAI_API_KEY=<"%~dp0openai.key"
)
if exist "%~dp0assistant.id" (
  set /p OPENAI_ASSISTANT_ID=<"%~dp0assistant.id"
)

REM Sunucuyu baslat
echo Sunucu baslatiliyor...
start "Chatbot Server" cmd /k ""%PYTHON_EXE%" chatbot_server.py"

REM Sunucunun hazir olmasini bekle
echo Sunucu hazirlanirken bekliyor...
timeout /t 6 /nobreak >nul

REM Tarayiciyi ac
echo Tarayici aciliyor...
start "" "http://127.0.0.1:5000/chatbot-with-product-verification.html"

echo.
echo ===============================================
echo   CHATBOT BASLATILDI
echo ===============================================
echo   URL: http://127.0.0.1:5000/chatbot-with-product-verification.html
echo   Sunucuyu kapatmak icin "Chatbot Server" penceresini kapatin
echo ===============================================
echo.
pause
exit /b 0