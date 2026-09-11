@echo off
cd /d "%~dp0"
set "SYNTAX_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "SYNTAX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist dist-local\index.html (
  "%SYNTAX_NODE%" node_modules\vite\bin\vite.js build --mode localpreview --outDir dist-local
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:3000 - login: demo / demo
echo Stop this server with Ctrl+C.
"%SYNTAX_NODE%" local-server.js
pause
