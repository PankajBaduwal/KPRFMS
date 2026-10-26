@echo off
REM Starts the FacultyCore API and web app in two windows, then opens the browser.
REM Requires MongoDB running locally (mongodb://localhost:27017).
cd /d "%~dp0"
start "FacultyCore - API (port 5055)" cmd /k "npm run dev:server"
start "FacultyCore - Web (port 5180)" cmd /k "npm run dev:client"
timeout /t 8 /nobreak >nul
start "" http://localhost:5180
