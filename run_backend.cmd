@echo off
echo Starting Backend...
cd backend

echo Killing old backend process (if any)...
wmic process where "name='node.exe' and commandline like '%%server.js%%'" call terminate >nul 2>&1

if not exist node_modules (
    echo Installing backend dependencies...
    npm install
)
node server.js
