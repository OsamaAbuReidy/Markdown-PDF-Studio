@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=if ($env:MDPDF_TARGET_SID) { 'Registry::HKEY_USERS\'+$env:MDPDF_TARGET_SID+'\Software\Classes\mdpdfstudio' } else { 'HKCU:\Software\Classes\mdpdfstudio' };" ^
  "if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }"

if errorlevel 1 (
  echo The browser shortcut could not be removed.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Notify Shell Associations.ps1"
if errorlevel 1 (
  echo The launcher was removed, but Windows could not refresh its protocol cache.
  pause
  exit /b 1
)

echo Markdown PDF Studio browser launcher removed.
if /i "%MDPDF_SILENT%"=="1" exit /b 0
pause
exit /b 0
