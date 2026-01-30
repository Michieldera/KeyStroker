#!/usr/bin/env python3
"""Simple runner script for KeyStroker"""
import sys
import os

# Change to the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Import and run
from app import app

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  KeyStroker - Keyboard Automation Tool")
    print("=" * 50)
    print("\n  Open your browser and go to: http://127.0.0.1:5001")
    print("\n  SAFETY: Move mouse to top-left corner to stop!")
    print("=" * 50 + "\n")
    app.run(debug=False, host="127.0.0.1", port=5001, threaded=True)
