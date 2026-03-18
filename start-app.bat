@echo off
if "%~1"=="" (
  start "Treez Sync" cmd /k "%~f0" run
  exit /b 0
)
cd /d "%~dp0"
title Treez Sync - Opticon ESL
echo ========================================
echo   Treez Sync Middleware
echo   Folder: %cd%
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed.
  echo Please install Node.js from https://nodejs.org/
  echo Then run this file again.
  pause
  exit /b 1
)

echo Node.js found: 
node -v
echo.

REM Install dependencies if node_modules missing
if not exist "node_modules" (
  echo Installing dependencies - first run only...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
  echo.
)

REM Build the app
echo Building...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.

echo ========================================
echo   App is starting at http://localhost:3000
echo   Press Ctrl+C to stop the app
echo ========================================
echo.

call npm start
echo.
echo App stopped. Press any key to close...
pause >nul
