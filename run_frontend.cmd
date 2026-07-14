@echo off
echo Starting Frontend (VibeChat)...
cd vibechat
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)
npm start
