@echo off
echo Starting both Frontend and Backend...

:: Start frontend in a new command prompt window
start "Frontend (VibeChat)" cmd /k "cd vibechat-vite && npm run dev"

:: Start backend in a new command prompt window
start "Backend" cmd /k "%~dp0run_backend.cmd"

echo Both services are starting...
