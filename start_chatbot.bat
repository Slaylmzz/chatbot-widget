@echo off
setlocal

REM Calisma dizinini bu dosyanin bulundugu klasore ayarla
cd /d "%~dp0"

REM OpenAI ayarlari: openai.key ve assistant.id varsa ortam degiskenlerini yukle
if exist "%~dp0openai.key" (
  set /p OPENAI_API_KEY=<"%~dp0openai.key"
  echo OPENAI_API_KEY yüklendi.
) else (
  echo Uyari: OPENAI_API_KEY icin "%~dp0openai.key" bulunamadi.
)
if exist "%~dp0assistant.id" (
  set /p OPENAI_ASSISTANT_ID=<"%~dp0assistant.id"
  echo OPENAI_ASSISTANT_ID yüklendi.
)

echo [1/2] Backend sunucusu baslatiliyor...
set "PYTHON_EXE=python"
if exist "%~dp0.venv\Scripts\python.exe" set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
start "Chatbot Server" cmd /k "%PYTHON_EXE% chatbot_server.py"

echo [2/2] Arayuz aciliyor...
REM Sunucunun ayaga kalkmasi icin kisa bir bekleme
timeout /t 2 /nobreak >nul
start "" "%~dp0chatbot-with-product-verification.html"

echo Hepsi hazir. Bu pencereyi kapatabilirsiniz.
exit /b 0 