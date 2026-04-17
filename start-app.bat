@echo off
setlocal EnableExtensions
REM Laravel-style launcher: new window, banner, checks, install, build, start

if "%~1"=="" (
  start "Treez Sync | Perfect Union" cmd /k "%~f0" run
  exit /b 0
)

cd /d "%~dp0"
chcp 65001 >nul
title Treez Sync ^| Opticon ESL

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "BANNER=%~dp0scripts\start-banner.ps1"

call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Header
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Info -Text "Working directory: %cd%"
where node >nul 2>nul
if %errorlevel% neq 0 (
  call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Error -Text "Node.js is not installed. Install from https://nodejs.org/ and run this file again."
  pause
  exit /b 1
)
for /f "delims=" %%V in ('node -v 2^>nul') do set "NODE_VER=%%V"
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Info -Text "Node.js %NODE_VER%"
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Line

if not exist "node_modules" (
  call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Info -Text "Installing npm dependencies (first run only)..."
  call npm install
  if errorlevel 1 (
    call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Error -Text "npm install failed."
    pause
    exit /b 1
  )
  call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Success -Text "Dependencies installed."
) else (
  call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Info -Text "node_modules present — skipping npm install."
)

call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Line
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Info -Text "Building production bundle (next build)..."
call npm run build
if errorlevel 1 (
  call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Error -Text "npm run build failed."
  pause
  exit /b 1
)
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Success -Text "Build completed successfully."

call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Line
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Url -Text "http://localhost:3000"
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Footer

call npm start
echo.
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Line
call "%PS%" -NoProfile -ExecutionPolicy Bypass -File "%BANNER%" -Mode Info -Text "Server stopped. Press any key to close this window."
pause >nul
endlocal
