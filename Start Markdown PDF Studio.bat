@echo off
setlocal
cd /d "%~dp0"

set "STUDIO_URL=http://127.0.0.1:4173/"

powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%STUDIO_URL%health'; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto open_studio

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is required but was not found.
  echo Install Node.js from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\marked\package.json" (
  echo First-time setup: installing the small required packages...
  where pnpm.cmd >nul 2>&1
  if not errorlevel 1 (
    call pnpm install
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo Setup failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

start "Markdown PDF Studio Server" /min cmd.exe /c "cd /d ""%~dp0"" && node src\server.mjs"

for /l %%G in (1,1,20) do (
  powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%STUDIO_URL%health'; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto open_studio
  timeout /t 1 /nobreak >nul
)

echo The studio did not start. Close this window and try again.
pause
exit /b 1

:open_studio
if /i "%STUDIO_NO_OPEN%"=="1" exit /b 0
start "" "%STUDIO_URL%"
exit /b 0
