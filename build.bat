@echo off
REM ============================================================================
REM KeyStroker Build Script for Windows
REM ============================================================================
REM
REM This script builds the KeyStroker application as a single executable file.
REM
REM Prerequisites:
REM   - Python 3.8 or higher
REM   - pip (Python package manager)
REM
REM Usage:
REM   build.bat           - Build the executable
REM   build.bat clean     - Clean build artifacts
REM   build.bat install   - Install dependencies only
REM
REM ============================================================================

setlocal EnableDelayedExpansion

REM Set title
title KeyStroker Build

REM Colors (ANSI)
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "CYAN=[36m"
set "RESET=[0m"

echo.
echo %CYAN%============================================================================%RESET%
echo %CYAN%  KeyStroker Build Script%RESET%
echo %CYAN%============================================================================%RESET%
echo.

REM Check for clean argument
if "%1"=="clean" goto :clean

REM Check for install argument
if "%1"=="install" goto :install

REM Main build process
:build
echo %YELLOW%[1/4] Checking Python installation...%RESET%
python --version >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: Python is not installed or not in PATH%RESET%
    echo Please install Python 3.8 or higher from https://python.org
    exit /b 1
)
python --version
echo.

echo %YELLOW%[2/4] Installing/updating dependencies...%RESET%
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo %RED%ERROR: Failed to install dependencies%RESET%
    exit /b 1
)
pip install pyinstaller --quiet
if errorlevel 1 (
    echo %RED%ERROR: Failed to install PyInstaller%RESET%
    exit /b 1
)
echo Dependencies installed successfully.
echo.

echo %YELLOW%[3/4] Generating application icons...%RESET%
if not exist "assets\icon.ico" (
    python assets\create_icon.py
    if errorlevel 1 (
        echo %YELLOW%WARNING: Could not generate icons, using defaults%RESET%
    )
) else (
    echo Icons already exist, skipping generation.
)
echo.

echo %YELLOW%[4/4] Building executable with PyInstaller...%RESET%
echo This may take a few minutes...
echo.
pyinstaller KeyStroker.spec --clean --noconfirm
if errorlevel 1 (
    echo.
    echo %RED%ERROR: Build failed!%RESET%
    exit /b 1
)

echo.
echo %GREEN%============================================================================%RESET%
echo %GREEN%  BUILD SUCCESSFUL!%RESET%
echo %GREEN%============================================================================%RESET%
echo.
echo   Output: dist\KeyStroker.exe
echo.
echo   To run the application:
echo     dist\KeyStroker.exe
echo.
echo   The application will:
echo     - Start a web server on http://127.0.0.1:5001
echo     - Open your browser automatically
echo     - Show an icon in the system tray
echo.
goto :end

:install
echo %YELLOW%Installing dependencies only...%RESET%
pip install -r requirements.txt
pip install pyinstaller
echo.
echo %GREEN%Dependencies installed successfully!%RESET%
goto :end

:clean
echo %YELLOW%Cleaning build artifacts...%RESET%
if exist "build" (
    rmdir /s /q build
    echo   Removed: build\
)
if exist "dist" (
    rmdir /s /q dist
    echo   Removed: dist\
)
if exist "__pycache__" (
    rmdir /s /q __pycache__
    echo   Removed: __pycache__\
)
if exist "*.spec.bak" (
    del /q *.spec.bak
    echo   Removed: *.spec.bak
)
echo.
echo %GREEN%Clean complete!%RESET%
goto :end

:end
endlocal
