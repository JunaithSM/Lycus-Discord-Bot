@echo off
title Lycus Bot - Launcher
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul

echo ====================================================
echo             Lycus Discord Bot Launcher
echo ====================================================
echo.

:: Change to the folder where the .bat file lives
cd /d "%~dp0"

:: ── 1. Must be run from the correct folder ────────────────────────────────────
if not exist "package.json" (
    echo [ERROR] Could not find the bot files in this folder.
    echo.
    echo Please make sure run.bat is in the SAME folder as package.json.
    echo.
    pause
    exit /b 1
)

:: ── 2. Check if Node.js is installed ─────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is NOT installed on this system.
    echo [i] Trying to install it automatically...
    echo.

    where winget >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Automatic install is not available on your Windows version.
        echo.
        echo Please do the following:
        echo   1. Open your browser and go to: https://nodejs.org/
        echo   2. Click the big green LTS download button
        echo   3. Run the installer and click Next on every screen
        echo   4. After it finishes, double-click run.bat again
        echo.
        pause
        exit /b 1
    )

    echo [i] Installing Node.js. This may take a minute, do NOT close this window.
    echo.
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Automatic install failed.
        echo.
        echo Please do the following manually:
        echo   1. Open your browser and go to: https://nodejs.org/
        echo   2. Click the big green LTS download button
        echo   3. Run the installer, click Next on every screen
        echo   4. Restart your computer, then double-click run.bat again
        echo.
        pause
        exit /b 1
    )

    echo.
    echo [SUCCESS] Node.js installed!
    echo.
    echo IMPORTANT: Close this window and double-click run.bat again to start the bot.
    echo.
    pause
    exit /b 0
)

:: Verify node actually runs
node --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was found but could not be launched.
    echo Please restart your computer and then double-click run.bat again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
echo [OK] Node.js is installed  (%NODE_VER%)
echo.

:: ── 3. Verify npm is available ────────────────────────────────────────────────
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm was not found even though Node.js is installed.
    echo Please restart your computer and double-click run.bat again.
    echo.
    pause
    exit /b 1
)

:: ── 4. Check / Create .env file ───────────────────────────────────────────────
:: FIX: token entry is its own labelled section outside of any if-block
if not exist ".env" goto setup_token

:: Validate existing .env has a non-empty token
set "env_ok=0"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="DISCORD_TOKEN" (
        if not "%%b"=="" set "env_ok=1"
    )
)
if "!env_ok!"=="0" (
    echo [WARNING] .env exists but DISCORD_TOKEN is missing or empty. Re-entering...
    del ".env" >nul 2>nul
    goto setup_token
)
echo [OK] Configuration file found.
echo.
goto deps

:setup_token
echo [i] First-time setup: your bot token is needed.
echo.
echo Where to find your token:
echo   1. Go to: https://discord.com/developers/applications
echo   2. Open your application, click "Bot" on the left
echo   3. Click "Reset Token" and copy the long string of text
echo.

:ask_token
set "token="
set /p token="Paste your Discord Bot Token here and press Enter: "

:: Strip accidental surrounding quotes
set "token=!token:"=!"

:: Strip leading spaces
for /f "tokens=* delims= " %%a in ("!token!") do set "token=%%a"

if "!token!"=="" (
    echo.
    echo [!] You did not enter a token. Please try again.
    echo.
    goto ask_token
)

:: Rough length check — real tokens are 59-72+ characters
set "len=0"
set "tmp=!token!"
:count_loop
    if "!tmp!"=="" goto count_done
    set "tmp=!tmp:~1!"
    set /a len+=1
    goto count_loop
:count_done

if !len! LSS 40 (
    echo.
    echo [!] That looks too short to be a real token ^(!len! characters^).
    echo     A Discord token is usually 59-72 characters long.
    echo     Please double-check and try again.
    echo.
    goto ask_token
)

(echo DISCORD_TOKEN=!token!)> .env
echo.
echo [OK] Token saved.
echo.

:: ── 5. Install / Update Dependencies ─────────────────────────────────────────
:deps
echo [i] Installing bot dependencies. This may take a minute on first run...
echo     Please do NOT close this window.
echo.

call npm install --loglevel=error 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo.
    echo Common fixes:
    echo   - Make sure you are connected to the internet
    echo   - Temporarily disable your antivirus and try again
    echo   - Right-click run.bat and choose "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies are ready.
echo.

:: ── 6. Start the Bot ──────────────────────────────────────────────────────────
:start_bot
echo ====================================================
echo  Lycus Bot is starting... Do NOT close this window.
echo  To stop the bot, press Ctrl + C
echo ====================================================
echo.

call npm start
set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE% equ 0 (
    echo [i] The bot shut down normally.
    pause
) else (
    echo [ERROR] The bot stopped unexpectedly ^(exit code: %EXIT_CODE%^).
    echo.
    echo What to try:
    echo   1. Make sure your bot token in .env is correct
    echo      ^(delete the .env file and run this script again to re-enter it^)
    echo   2. Check your bot at: https://discord.com/developers/applications
    echo   3. Make sure your computer has internet access
    echo.
    echo Restarting in 5 seconds... Press Ctrl+C to stop.
    echo.
    timeout /t 5 >nul
    goto start_bot
)