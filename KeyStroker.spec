# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller specification file for KeyStroker.

To build:
    pyinstaller KeyStroker.spec --clean

This creates a single-file executable in the dist/ directory.
"""

import os
import sys

# Get the directory where this spec file is located
SPEC_DIR = os.path.dirname(os.path.abspath(SPECPATH))

# Analysis - gather all dependencies
a = Analysis(
    ['tray_app.py'],  # Main entry point
    pathex=[SPEC_DIR],
    binaries=[],
    datas=[
        # Include template files
        ('templates', 'templates'),
        # Include static files (CSS, JS)
        ('static', 'static'),
        # Include assets (icons)
        ('assets', 'assets'),
        # Note: patterns directory is NOT included - app creates it at runtime
        # This prevents bundling user configs into the release
    ],
    hiddenimports=[
        # System tray dependencies
        'pystray._win32',
        'PIL._tkinter_finder',
        # Flask dependencies
        'flask',
        'jinja2',
        'werkzeug',
        # Automation dependencies
        'pyautogui',
        'pygetwindow',
        'pyperclip',
        # Other
        'requests',
        'queue',
        'threading',
        'webbrowser',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unnecessary modules to reduce size
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'IPython',
        'notebook',
        'pytest',
    ],
    noarchive=False,
    optimize=0,
)

# Create the PYZ archive
pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=None,
)

# Create the executable
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='KeyStroker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Use UPX compression if available
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window (GUI app with system tray)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/icon.ico',  # Application icon
    version='file_version_info.txt' if os.path.exists('file_version_info.txt') else None,
)
