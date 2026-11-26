@echo off
rem Publish the book: collect diagram images, check, build, commit and push.
rem See WRITING-GUIDE.md, "Publishing with sync". Double-click this file, or run it in a terminal.
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed on this computer, so sync can't run. Install it from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)
call npm --prefix "%~dp0.site" run --silent sync
set "code=%errorlevel%"
echo.
pause
exit /b %code%
