@echo off
REM Start a local server in this folder and open the quiz in the default browser.
cd /d "%~dp0"
set PORT=8000
start "" "http://localhost:%PORT%"
echo Serving on http://localhost:%PORT%  (Ctrl+C to stop)
python -m http.server %PORT%
