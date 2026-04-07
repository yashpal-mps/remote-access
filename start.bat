@echo off
REM Capture It - Quick Start Script for Windows
REM This script helps you get started quickly

echo ======================================
echo   Capture It - Remote Desktop Setup
echo ======================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed. Please install Node.js 18+ first.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

echo Installing dependencies...

REM Install root dependencies
call npm install

REM Install renderer dependencies
cd renderer
call npm install
cd ..

REM Install signaling server dependencies
cd signaling-server
call npm install
cd ..

echo.
echo [OK] All dependencies installed!
echo.
echo Starting signaling server locally...

REM Start signaling server in background
start "Signaling Server" cmd /k "cd signaling-server && node server.js"

timeout /t 2 /nobreak >nul

echo.
echo Starting Electron app...
echo.
echo ======================================
echo   Opening Capture It...
echo ======================================
echo.

REM Start Electron
call npm run dev
