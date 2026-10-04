@echo off
title Serial Tester
echo Starting Serial Tester...

start /min "" node "%~dp0serial-tester.js"

echo Waiting for server...
:wait
timeout /t 1 /nobreak >nul
powershell -Command "try { (Invoke-WebRequest -Uri http://localhost:3456 -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait

echo Server ready, opening app...
start "" msedge --app=http://localhost:3456 --window-size=800,600
