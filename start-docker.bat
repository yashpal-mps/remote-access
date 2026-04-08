@echo off
REM Start Docker Signaling Server
REM This script waits for Docker to be ready, then starts the signaling server

echo ============================================
echo   Capture It - Docker Signaling Server
echo ============================================
echo.

echo [1/4] Checking Docker status...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Docker is not ready yet.
    echo.
    echo Please wait for Docker Desktop to finish starting...
    echo This can take 30-60 seconds on first launch.
    echo.
    echo Waiting 30 seconds...
    timeout /t 30 /nobreak >nul
    echo.
    
    docker info >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Docker is still not ready.
        echo.
        echo Please:
        echo   1. Check Docker Desktop window
        echo   2. Wait until it shows "Docker Desktop is running"
        echo   3. Look for green whale icon in system tray
        echo   4. Then run this script again
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Docker is running
echo.

echo [2/4] Navigating to signaling-server...
cd signaling-server

echo [3/4] Starting signaling server container...
docker-compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start container.
    echo.
    echo Troubleshooting:
    echo   - Check if port 3000 is already in use
    echo   - Run: docker-compose logs
    echo   - Run: docker ps -a
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Container started successfully!
echo.

echo [4/4] Verifying container is running...
timeout /t 3 /nobreak >nul
docker ps --filter "name=capture-it-signaling" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ============================================
echo   Signaling Server is Running!
echo ============================================
echo.
echo URL: ws://localhost:3000
echo Container: capture-it-signaling
echo.
echo Useful commands:
echo   View logs: docker logs -f capture-it-signaling
echo   Stop: docker-compose down
echo   Restart: docker-compose restart
echo.
echo You can now start the Electron app!
echo.
pause
