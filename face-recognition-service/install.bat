@echo off
echo ============================================
echo  Face Recognition Service — Install (Windows)
echo ============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Download from https://python.org
    pause
    exit /b 1
)

echo Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment.
    pause
    exit /b 1
)

echo Installing dependencies...
venv\Scripts\pip install --upgrade pip >nul
venv\Scripts\pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

if not exist .env (
    copy .env.example .env >nul
    echo Created .env from .env.example
)

echo.
echo ============================================
echo  Installation complete.
echo  Run start.bat to launch the service.
echo  NOTE: First launch downloads the ArcFace model (~500MB).
echo ============================================
pause
