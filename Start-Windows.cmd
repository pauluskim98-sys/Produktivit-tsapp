@echo off
setlocal
cd /d "%~dp0"
set "RAUM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%RAUM_NODE%" set "RAUM_NODE=node"
"%RAUM_NODE%" -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Bitte Node.js 24 oder neuer installieren.
  pause
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo Die Abhaengigkeiten fehlen. Bitte pnpm install ausfuehren.
  pause
  exit /b 1
)
if not exist ".next\BUILD_ID" (
  "%RAUM_NODE%" node_modules\next\dist\bin\next build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Raum oeffnen: http://127.0.0.1:3000
echo Dieses Fenster offen lassen. Beenden mit Strg+C.
"%RAUM_NODE%" node_modules\next\dist\bin\next start --hostname 127.0.0.1 --port 3000
pause
