#!/bin/sh
# Starts A deckbuilder on macOS or Linux (double-click on a Mac, or run ./start.command).
# Needs Python 3 or PowerShell 7. Close the window (or press Ctrl+C) to stop.
cd "$(dirname "$0")" || exit 1
PORT=47123
URL="http://localhost:$PORT/"
open_browser() { sleep 1; (open "$URL" || xdg-open "$URL") >/dev/null 2>&1; }
if command -v python3 >/dev/null 2>&1; then
  echo "A deckbuilder is running at $URL — keep this window open while you use it."
  open_browser & exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v pwsh >/dev/null 2>&1; then
  exec pwsh -NoProfile -File tools/serve.ps1 -Port "$PORT"
else
  echo "A deckbuilder needs Python 3 (https://www.python.org/downloads/) to run on this computer."
  read -r _
fi
