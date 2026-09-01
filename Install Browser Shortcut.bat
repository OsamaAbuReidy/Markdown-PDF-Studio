@echo off
setlocal
cd /d "%~dp0"

set "MDPDF_LAUNCHER=%~dp0Start Markdown PDF Studio.bat"
set "MDPDF_HANDLER=%~dp0Protocol Launcher.ps1"

if not exist "%MDPDF_LAUNCHER%" (
  echo The Markdown PDF Studio launcher could not be found.
  pause
  exit /b 1
)

if not exist "%MDPDF_HANDLER%" (
  echo The Markdown PDF Studio protocol handler could not be found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root=if ($env:MDPDF_TARGET_SID) { 'Registry::HKEY_USERS\'+$env:MDPDF_TARGET_SID+'\Software\Classes\mdpdfstudio' } else { 'HKCU:\Software\Classes\mdpdfstudio' };" ^
  "$commandKey=Join-Path $root 'shell\open\command';" ^
  "$handler=$env:MDPDF_HANDLER;" ^
  "$quote=[char]34;" ^
  "$command='powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File '+$quote+$handler+$quote;" ^
  "New-Item -Path $commandKey -Force | Out-Null;" ^
  "Set-Item -Path $root -Value 'URL:Markdown PDF Studio Protocol';" ^
  "New-ItemProperty -Path $root -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null;" ^
  "Set-Item -Path $commandKey -Value $command;"

if errorlevel 1 (
  echo.
  echo The browser shortcut could not be installed.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Notify Shell Associations.ps1"
if errorlevel 1 (
  echo The launcher was registered, but Windows could not refresh its protocol cache.
  pause
  exit /b 1
)

echo.
echo Browser launcher installed successfully.
echo Bookmark this address: mdpdfstudio://start
echo.
if /i "%MDPDF_SILENT%"=="1" exit /b 0
start "" "%~dp0Browser Bookmark Setup.html"
pause
exit /b 0
