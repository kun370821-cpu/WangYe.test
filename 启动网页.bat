@echo off
rem ============================================================
rem  Family Phonebook - local preview launcher
rem
rem  This file is deliberately ASCII-only and uses CRLF, because
rem  cmd.exe mis-reads Chinese text inside .bat files (lines get
rem  split, the window flashes and closes at once). All Chinese
rem  messages are printed by serve.py, where they are safe.
rem ============================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Family Phonebook

rem If the port is busy, change 8000 to another number, e.g. 9000
set PORT=8000

python --version >nul 2>nul
if errorlevel 1 goto nopython

python "%~dp0serve.py" %PORT%

echo.
echo   Server stopped.
pause
exit /b 0

:nopython
echo.
echo   [X] Python was not found on this computer.
echo.
echo       Install Python 3 from:  https://www.python.org/downloads/
echo       During setup, tick "Add python.exe to PATH".
echo       Then double-click this file again.
echo.
pause
exit /b 1


