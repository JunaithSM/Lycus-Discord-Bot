@echo off
title Lycus Bot - Launcher
setlocal enabledelayedexpansion

echo ====================================================
echo             Lycus Discord Bot Launcher
echo ====================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is NOT installed on this system.
    echo [i] Attempting to install Node.js automatically via Windows Package Manager (winget)...
    echo.
    
    where winget >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Windows Package Manager (winget) was not found. 
        echo Please download and install Node.js manually from: https://nodejs.org/
        echo After installing, double-click this script again.
        pause
        exit /b
    )
    
    :: Install Node.js LTS via winget
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Automatic installation failed or was cancelled.
        echo Please download and install Node.js manually from: https://nodejs.org/
        pause
        exit /b
    )
    
    echo.
    echo [SUCCESS] Node.js has been successfully installed!
    echo [!] IMPORTANT: You MUST close this window and double-click run.bat again to start.
    echo.
    pause
    exit /b
)

echo [OK] Node.js is installed.
echo.

:: 2. Check/Create .env file
if not exist .env (
    echo [i] Configuration file (.env) not found. Let's set it up.
    echo.
    set /p token="Enter your Discord Bot Token: "
    
    :: Clean quotes if user pasted them
    set "token=!token:"=!"
    
    echo DISCORD_TOKEN="!token!" > .env
    echo [OK] Configuration saved to .env.
    echo.
) else (
    echo [OK] Configuration file (.env) found.
)

:: 3. Install/Update Dependencies
echo [i] Installing/updating bot dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies. Please ensure you are connected to the internet.
    pause
    exit /b
)
echo [OK] Dependencies ready.
echo.

:: 4. Start the Bot
echo [i] Starting Lycus Bot...
echo.
call npm start
if %errorlevel% neq 0 (
    echo.
    echo [i] Bot stopped or crashed.
    pause
)
