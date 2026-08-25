@echo off
cd /d "%~dp0"
node scripts/analytics-dashboard.cjs
if errorlevel 1 pause
