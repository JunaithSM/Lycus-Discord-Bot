#Requires -Version 5.0
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ─── Log file (helps you debug remotely if your friend has issues) ───────────
$logPath = "bot-log.txt"
function Write-Log {
    param([string]$msg)
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$stamp  $msg" | Out-File -FilePath $logPath -Append -Encoding UTF8
}

function Show-Header {
    Clear-Host
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "            Lycus Discord Bot Launcher              " -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Exit-WithPause {
    param([int]$code = 1)
    Write-Host ""
    Read-Host "Press Enter to close this window"
    Exit $code
}

Write-Log "=== Launcher started ==="
Show-Header

# ─── 1. Correct folder check ─────────────────────────────────────────────────
if (!(Test-Path "package.json")) {
    Write-Host "[ERROR] This launcher is in the wrong folder." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make sure run.bat is placed inside the bot folder"
    Write-Host "(the same folder that contains package.json and index.js)."
    Write-Log "ERROR: package.json not found in $(Get-Location)"
    Exit-WithPause
}

# ─── 2. Refresh PATH so a just-installed Node is found ───────────────────────
function Update-SessionPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path    = "$machinePath;$userPath"
}

# ─── 3. Node.js check / auto-install ─────────────────────────────────────────
function Get-NodeVersion {
    try { return (& node --version 2>$null).Trim() } catch { return $null }
}

$nodeVer = Get-NodeVersion

if (!$nodeVer) {
    Write-Host "[!] Node.js is not installed." -ForegroundColor Yellow
    Write-Log "Node.js not found — attempting winget install"

    if (!(Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "[ERROR] Cannot auto-install Node.js on this Windows version." -ForegroundColor Red
        Write-Host ""
        Write-Host "Please do this manually (takes about 2 minutes):"
        Write-Host "  1. Open your browser and go to:  https://nodejs.org/"
        Write-Host "  2. Click the big green 'LTS' download button."
        Write-Host "  3. Run the downloaded file and click Next on every screen."
        Write-Host "  4. Restart your computer."
        Write-Host "  5. Double-click run.bat again."
        Write-Log "ERROR: winget not available"
        Exit-WithPause
    }

    Write-Host "[i] Installing Node.js automatically. Please wait — do NOT close this window..." -ForegroundColor Cyan
    $p = Start-Process winget -ArgumentList "install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent" -NoNewWindow -PassThru -Wait

    if ($p.ExitCode -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] Automatic installation failed (code $($p.ExitCode))." -ForegroundColor Red
        Write-Host "Please install Node.js manually from https://nodejs.org/ and restart."
        Write-Log "ERROR: winget install failed with exit code $($p.ExitCode)"
        Exit-WithPause
    }

    # Reload PATH so the new install is visible without restarting
    Update-SessionPath
    $nodeVer = Get-NodeVersion

    if (!$nodeVer) {
        # Installed but PATH still not visible — ask user to relaunch
        Write-Host ""
        Write-Host "[OK] Node.js was installed!" -ForegroundColor Green
        Write-Host ""
        Write-Host "[ACTION NEEDED] Please close this window and double-click run.bat again." -ForegroundColor Yellow
        Write-Log "Node installed; PATH reload insufficient — user must relaunch"
        Exit-WithPause 0
    }
}

Write-Host "[OK] Node.js $nodeVer is ready." -ForegroundColor Green
Write-Log "Node.js version: $nodeVer"

# ─── 4. npm check ────────────────────────────────────────────────────────────
Update-SessionPath
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "[ERROR] npm was not found even though Node.js is installed." -ForegroundColor Red
    Write-Host "Please restart your computer and run again."
    Write-Log "ERROR: npm not found after Node install"
    Exit-WithPause
}

# ─── 5. .env / token setup ───────────────────────────────────────────────────
$envPath   = ".env"
$setupToken = $false

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    # Direct -match on the string — $Matches is reliable here
    if ($envContent -match "(?m)^DISCORD_TOKEN\s*=\s*(.+)") {
        $tokenVal = $Matches[1].Trim().Trim('"').Trim("'")
        if ([string]::IsNullOrWhiteSpace($tokenVal)) { $setupToken = $true }
    } else {
        $setupToken = $true
    }
} else {
    $setupToken = $true
}

if ($setupToken) {
    Write-Host ""
    Write-Host "[i] First-time setup: your Discord bot token is needed." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "How to get your token (30 seconds):"
    Write-Host "  1. Go to:  https://discord.com/developers/applications"
    Write-Host "  2. Click your application, then click 'Bot' on the left side."
    Write-Host "  3. Click 'Reset Token', confirm, and copy the token."
    Write-Host ""

    $token = ""
    $attempts = 0
    while ([string]::IsNullOrWhiteSpace($token)) {
        $attempts++
        if ($attempts -gt 10) {
            Write-Host "[ERROR] Too many failed attempts. Please restart the launcher." -ForegroundColor Red
            Write-Log "ERROR: token entry failed after 10 attempts"
            Exit-WithPause
        }

        $raw = Read-Host "Paste your Discord Bot Token here and press Enter"
        # Strip all common accidental wrappers and invisible characters
        $token = $raw.Trim() -replace '^["\s'']+' -replace '["\s'']+$'
        # Remove any non-printable / zero-width characters
        $token = [System.Text.RegularExpressions.Regex]::Replace($token, "[^\x20-\x7E]", "")

        if ([string]::IsNullOrWhiteSpace($token)) {
            Write-Host ""
            Write-Host "[!] Nothing was entered. Please try again." -ForegroundColor Yellow
            Write-Host ""
            $token = ""
        } elseif ($token.Length -lt 40) {
            Write-Host ""
            Write-Host "[!] That looks too short ($($token.Length) characters). A real token is 59-72 characters." -ForegroundColor Yellow
            Write-Host "    Please copy the full token and try again."
            Write-Host ""
            $token = ""
        } elseif ($token.Length -gt 120) {
            Write-Host ""
            Write-Host "[!] That looks too long ($($token.Length) characters). Did you accidentally copy extra text?" -ForegroundColor Yellow
            Write-Host "    Please copy only the token string and try again."
            Write-Host ""
            $token = ""
        }
    }

    # Write with trailing newline, no BOM
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envPath, "DISCORD_TOKEN=$token`n", $utf8WithoutBom)
    Write-Host ""
    Write-Host "[OK] Token saved." -ForegroundColor Green
    Write-Log "Token saved to .env (length: $($token.Length))"
} else {
    Write-Host "[OK] Configuration file (.env) found." -ForegroundColor Green
    Write-Log ".env already configured"
}

Write-Host ""

# ─── 6. Install / update dependencies (with one retry) ───────────────────────
Write-Host "[i] Installing/updating bot files. Please wait..." -ForegroundColor Cyan
Write-Host "    This needs internet access. Do NOT close this window."
Write-Host ""

$installed = $false
for ($try = 1; $try -le 2; $try++) {
    $p = Start-Process npm -ArgumentList "install --loglevel=error" -NoNewWindow -PassThru -Wait
    if ($p.ExitCode -eq 0) { $installed = $true; break }

    if ($try -eq 1) {
        Write-Host ""
        Write-Host "[!] First attempt failed. Retrying in 5 seconds..." -ForegroundColor Yellow
        Write-Log "npm install failed on attempt 1 (exit $($p.ExitCode)) — retrying"
        Start-Sleep -Seconds 5
    }
}

if (!$installed) {
    Write-Host ""
    Write-Host "[ERROR] Could not install bot files." -ForegroundColor Red
    Write-Host "Please check your internet connection and try again."
    Write-Log "ERROR: npm install failed after 2 attempts"
    Exit-WithPause
}

Write-Host "[OK] Bot files are ready." -ForegroundColor Green
Write-Log "npm install succeeded"
Write-Host ""

# ─── 7. Bot start loop ───────────────────────────────────────────────────────
$MAX_CRASHES   = 5          # stop auto-restarting after this many crashes
$RESTART_DELAY = 5          # seconds to wait between restarts
$crashCount    = 0

while ($true) {
    Show-Header
    Write-Host " Lycus Bot is running.  Do NOT close this window." -ForegroundColor Green
    Write-Host " To stop the bot, press Ctrl + C" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Log "Bot process starting (crash count so far: $crashCount)"

    $startTime = Get-Date
    try {
        # Directly launch node to avoid orphaned processes when terminated (Ctrl+C).
        # Append output to bot-log.txt using Tee-Object while rendering to console.
        node index.js 2>&1 | Tee-Object -FilePath $logPath -Append
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        Write-Log "ERROR: Failed to run node: $_"
    }

    $duration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host ""
    Write-Log "Bot process exited with code $exitCode (duration: $duration seconds)"

    # Clean / intentional shutdown
    if ($exitCode -eq 0) {
        Write-Host "[i] The bot shut down normally." -ForegroundColor Cyan
        Write-Log "Bot shut down cleanly"
        Exit-WithPause 0
    }

    # If it ran successfully for more than 30 seconds, reset crash count
    if ($duration -gt 30) {
        Write-Log "Resetting crash count because bot ran successfully for $duration seconds"
        $crashCount = 0
    }

    # Crash
    $crashCount++
    Write-Host "[ERROR] The bot stopped unexpectedly (code: $exitCode)." -ForegroundColor Red
    Write-Host ""

    if ($crashCount -ge $MAX_CRASHES) {
        Write-Host "The bot has crashed $crashCount times in a row." -ForegroundColor Red
        Write-Host "Automatic restarts have been stopped to protect your system." -ForegroundColor Red
        Write-Host ""
        Write-Host "Please send the file  bot-log.txt  to whoever set this up for you." -ForegroundColor Yellow
        Write-Host "(It is in the same folder as run.bat)"
        Write-Log "ERROR: reached max crash count ($MAX_CRASHES) — stopping auto-restart"
        Exit-WithPause
    }

    Write-Host "Possible causes:"
    Write-Host "  - Wrong bot token in .env  →  delete the .env file and restart run.bat"
    Write-Host "  - No internet connection"
    Write-Host "  - Discord servers are temporarily down"
    Write-Host ""
    Write-Host "Restarting in $RESTART_DELAY seconds... (crash $crashCount of $MAX_CRASHES)"
    Write-Host "Press Ctrl+C at any time to stop."
    Write-Host ""
    Start-Sleep -Seconds $RESTART_DELAY
}