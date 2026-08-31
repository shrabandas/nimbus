@echo off
setlocal

rem Force this script to run from its own folder, no matter how it was launched
rem (e.g. "Run as administrator" resets the working directory to System32).
cd /d "%~dp0"

echo Checking Node.js version...
node -v >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on your PATH.
  echo Install Node.js 22.5.0 or newer from https://nodejs.org and try again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Found Node.js %%v

if not exist "%~dp0backend\server.js" (
  echo ERROR: Could not find backend\server.js next to this script.
  echo Make sure start.bat is still inside the extracted crypto-dashboard folder.
  pause
  exit /b 1
)

echo.
echo Starting backend on http://localhost:4000 ...
start "Nimbus Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

timeout /t 2 /nobreak >nul

echo Starting frontend on http://localhost:5173 ...
start "Nimbus Frontend" cmd /k "cd /d "%~dp0frontend" && node serve.js"

timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo  Nimbus is running:
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:4000
echo.
echo  Admin login -^> admin@demo.local / Admin123!
echo.
echo  Close the two new windows to stop the servers.
echo ==========================================

start http://localhost:5173
