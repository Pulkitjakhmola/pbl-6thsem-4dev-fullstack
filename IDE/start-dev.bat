@echo off
echo ==========================================
echo   AMScode + Platform - Dev Startup
echo ==========================================
echo.

echo [1/3] Syncing database schema...
cd /d "%~dp0server"
set PRISMA_CLIENT_ENGINE_TYPE=binary
set PRISMA_CLI_QUERY_ENGINE_TYPE=binary
call npx prisma db push --skip-generate >nul 2>&1
echo      Done.

echo.
echo [2/3] Starting backend server...
cd /d "%~dp0server"
start "AMS-Backend" cmd /c "set PRISMA_CLIENT_ENGINE_TYPE=binary && npx tsx watch src/index.ts"

timeout /t 3 >nul

echo [3/3] Starting frontend...
cd /d "%~dp0client"
start "AMS-Frontend" cmd /c "npx vite --port 5173"

echo.
echo ==========================================
echo   All services started!
echo   Backend:   http://localhost:3001
echo   Frontend:  http://localhost:5173
echo ==========================================
echo.
echo   Open http://localhost:5173 in your browser.
echo   Register a new account - first user is SUPER_ADMIN.
echo.
pause
