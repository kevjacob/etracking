@echo off
REM Run backup daemon: syncs Docker data to online Supabase once now, then every 1 hour.
REM Keep this window open while you want backups to continue. Run from project folder.

cd /d "%~dp0"

echo Starting backup daemon...
npm run backup:daemon
