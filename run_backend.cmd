@echo off
echo Starting Backend...
cd backend

if not exist node_modules (
    echo Installing backend dependencies...
    npm install
)
node server.js
