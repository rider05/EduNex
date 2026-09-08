@echo off
setlocal enabledelayedexpansion

:: Route to root build-apk.bat
set "SCRIPT_DIR=%~dp0.."
call "%SCRIPT_DIR%\build-apk.bat"
