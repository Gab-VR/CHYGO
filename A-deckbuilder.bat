@echo off
rem Starts A deckbuilder on http://localhost:8000 and opens it in your browser.
rem Close the "A deckbuilder server" window to stop it.

start "A deckbuilder server" wsl -d Ubuntu --cd /home/gaby/Projects/chygo python3 -m http.server 8000
timeout /t 2 /nobreak >nul
start "" http://localhost:8000
