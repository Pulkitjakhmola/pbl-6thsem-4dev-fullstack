@echo off
echo ==========================================
echo   AMScode - Electron Desktop Launch
echo ==========================================
echo.

echo [1/4] Syncing database schema...
cd /d "%~dp0server"
set PRISMA_CLIENT_ENGINE_TYPE=binary
set PRISMA_CLI_QUERY_ENGINE_TYPE=binary
call npx prisma db push --skip-generate >nul 2>&1
echo      Done.

echo.
echo [2/4] Checking Electron...
cd /d "%~dp0client"
if exist "node_modules\electron" goto electron_ok
echo      Installing Electron (one-time, ~600MB)...
call npm install electron --save-dev
if errorlevel 1 goto electron_fail
echo      Installed!
goto start_servers

:electron_fail
echo      ERROR: Electron install failed.
pause
exit /b 1

:electron_ok
echo      Electron found.

:start_servers
echo.
echo [3/4] Starting backend server...
cd /d "%~dp0server"
start "AMS-Backend" cmd /c "set PRISMA_CLIENT_ENGINE_TYPE=binary && npx tsx watch src/index.ts"

timeout /t 3 >nul

echo [4/4] Starting Vite + Electron...
cd /d "%~dp0client"
start "AMS-Vite" cmd /c "npx vite --port 5173"

timeout /t 5 >nul

echo Launching Electron desktop app...
cd /d "%~dp0client"
start "AMS-Electron" cmd /c "npx wait-on http://localhost:5173 && npx electron ."

echo.
echo ==========================================
echo   All services started!
echo   Backend:   http://localhost:3001
echo   Vite:      http://localhost:5173
echo   Electron:  Desktop window
echo ==========================================
echo.
pause
