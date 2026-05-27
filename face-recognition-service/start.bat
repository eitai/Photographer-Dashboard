@echo off
if not exist venv (
    echo ERROR: Run install.bat first.
    pause
    exit /b 1
)
if not exist .env copy .env.example .env >nul

for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
    if /i "%%A"=="HOST" set HOST=%%B
    if /i "%%A"=="PORT" set PORT=%%B
)
if not defined HOST set HOST=127.0.0.1
if not defined PORT set PORT=8001

echo Starting Face Recognition Service on %HOST%:%PORT%
venv\Scripts\uvicorn main:app --host %HOST% --port %PORT% --workers 1
