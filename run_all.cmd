@echo off
echo Starting both Frontend and Backend...

:: Start frontend in a new command prompt window
start "Frontend (VibeChat)" cmd /k "d:\DuAn\VibeChat\run_frontend.cmd"

:: Start backend in a new command prompt window
start "Backend" cmd /k "d:\DuAn\VibeChat\run_backend.cmd"

echo Both services are starting...
