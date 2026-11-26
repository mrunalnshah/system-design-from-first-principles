@echo off
rem Publish the book: collect diagram images, check, build, commit and push.
rem See WRITING-GUIDE.md, "Publishing with sync". Double-click this file, or run it in a terminal.
cd /d "%~dp0"
call npm --prefix "%~dp0.site" run --silent sync
echo.
pause
