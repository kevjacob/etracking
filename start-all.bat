@echo off
REM Start Supabase (Docker), Vite dev server, and backup daemon in separate windows.
REM Run from project folder or double-click. Close each window when done.

cd /d "%~dp0"

echo Starting Supabase (Docker)...
start "Supabase" cmd /k "npx supabase start"

timeout /t 3 /nobreak >nul
echo Starting Vite dev server...
start "Vite Dev" cmd /k "npm run dev"

timeout /t 2 /nobreak >nul
echo Starting backup daemon (syncs to online Supabase every 1 hour)...
start "Backup Daemon" cmd /k "npm run backup:daemon"

echo.
echo All three windows are open. Close them when done, or run: npx supabase stop
exit
