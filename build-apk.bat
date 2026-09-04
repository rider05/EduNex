@echo off
setlocal enabledelayedexpansion

echo ===================================================================
echo   EduNex Automated APK Builder, Version Exporter ^& Git Pipeline
echo ===================================================================
echo.

set "TARGET_VER=%~1"

if "%TARGET_VER%"=="" (
    echo [i] No specific version argument passed.
    echo     Press ENTER to build using the current version in app.json,
    echo     or type a new version number (e.g., 1.0.2) and press ENTER.
    echo.
    set /p "USER_INPUT_VER=Enter Version (leave blank for auto): "
    if not "!USER_INPUT_VER!"=="" (
        set "TARGET_VER=!USER_INPUT_VER!"
    )
)

echo.
if not "%TARGET_VER%"=="" (
    echo [*] Starting pipeline for Version: %TARGET_VER%
    node "%~dp0scripts\export-apk.js" "%TARGET_VER%"
) else (
    echo [*] Starting pipeline using active version from app.json
    node "%~dp0scripts\export-apk.js"
)

if %errorlevel% equ 0 (
    echo.
    echo ===================================================================
    echo [OK] Release build, packaging ^& GitHub synchronization complete!
    echo ===================================================================
    echo.
    if "%~1"=="" pause
    exit /b 0
) else (
    echo.
    echo [!] Build pipeline exited with error code %errorlevel%.
    echo.
    if "%~1"=="" pause
    exit /b %errorlevel%
)
