@echo off
REM ============================================================
REM  AIGC Video Platform — Quick Start (Windows)
REM ============================================================
chcp 65001 >nul 2>&1

echo.
echo ================================================
echo   AIGC Video Platform - Quick Start
echo ================================================
echo.

REM --- Check Docker ---
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed.
    echo   Please install Docker Desktop:
    echo   https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [WARN] Docker is not running. Please start Docker Desktop.
    echo   Waiting 30 seconds...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    timeout /t 30 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Docker failed to start. Please open Docker Desktop manually.
        pause
        exit /b 1
    )
)
echo [OK] Docker is running

REM --- Check .env ---
if not exist backend\.env (
    echo [INFO] backend\.env not found, creating from template...
    copy backend\.env.example backend\.env >nul
    echo.
    echo   Please edit backend\.env and fill in your API keys:
    echo     ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY
    echo     KIE_API_KEY=YOUR_KIE_KEY
    echo.
    echo   Then run this script again.
    notepad backend\.env
    pause
    exit /b 0
)
echo [OK] Environment config ready

REM --- Build and start ---
echo.
echo Starting platform (first time takes 3-5 minutes)...
echo.
docker compose up --build -d

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start. Check Docker Desktop is running.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Platform started successfully!
echo ================================================
echo.
echo   Open in browser: http://localhost:5173
echo.
echo   Commands:
echo     View logs:    docker compose logs -f
echo     Stop:         docker compose down
echo     Rebuild:      docker compose up --build -d
echo.
pause
