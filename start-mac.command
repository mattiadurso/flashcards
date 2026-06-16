#!/bin/bash
# Start a local server in this folder and open the quiz in the default browser.
cd "$(dirname "$0")"
PORT=8000
( sleep 1 && open "http://localhost:${PORT}" ) &
echo "Serving on http://localhost:${PORT}  (Ctrl+C to stop)"
python3 -m http.server "${PORT}"
