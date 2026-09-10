@echo off
REM Start eTracking dev server (cloud Supabase — no Docker, no backup).
REM Requires .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY pointing at your cloud project.
REM Double-click or run from the project folder. Close this window when done.

cd /d "%~dp0"

echo.
echo eTracking — cloud mode
echo   Database: cloud Supabase (from .env)
echo   App:      http://localhost:5173
echo   LAN:      http://YOUR-PC-IP:5173  (run ipconfig to find your IP)
echo.
echo Starting Vite dev server...
echo.

npm run dev
