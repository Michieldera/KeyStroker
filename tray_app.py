#!/usr/bin/env python3
"""
KeyStroker System Tray Application

This is the main entry point for the KeyStroker application.
It runs the Flask server in the background and provides a system tray icon
for easy access and control.
"""

import os
import sys
import threading
import webbrowser
import time
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Change to script directory for proper resource loading
if getattr(sys, "frozen", False):
    # Running as compiled executable
    SCRIPT_DIR = os.path.dirname(sys.executable)
else:
    # Running as script
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

os.chdir(SCRIPT_DIR)

# Import dependencies
try:
    from PIL import Image
    import pystray
    from pystray import MenuItem as item
except ImportError as e:
    logger.error(f"Missing dependency: {e}")
    logger.error("Please install required packages: pip install pystray Pillow")
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None
    logger.warning("requests package not available - update checking disabled")

# Import app components
from app import app
from version import VERSION, APP_NAME, GITHUB_API_URL, GITHUB_RELEASES_URL

# Server configuration
HOST = "127.0.0.1"
PORT = 5001
URL = f"http://{HOST}:{PORT}"

# Global state
server_thread = None
tray_icon = None
flask_server = None


def get_icon_path():
    """Get the path to the icon file."""
    # Check various locations for the icon
    possible_paths = [
        os.path.join(SCRIPT_DIR, "assets", "icon.png"),
        os.path.join(SCRIPT_DIR, "assets", "icon.ico"),
        os.path.join(SCRIPT_DIR, "icon.png"),
        os.path.join(SCRIPT_DIR, "icon.ico"),
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path

    return None


def create_default_icon():
    """Create a simple default icon if no icon file is found."""
    # Create a simple 64x64 icon
    img = Image.new("RGBA", (64, 64), (74, 85, 104, 255))
    # Draw a simple "K" shape using pixels
    from PIL import ImageDraw

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([8, 8, 56, 56], radius=8, fill=(74, 85, 104))
    draw.rounded_rectangle([16, 16, 28, 28], radius=2, fill=(255, 255, 255))
    draw.rounded_rectangle([20, 32, 44, 44], radius=2, fill=(99, 179, 237))
    draw.rounded_rectangle([32, 16, 48, 28], radius=2, fill=(255, 255, 255))
    return img


def load_icon():
    """Load the application icon."""
    icon_path = get_icon_path()

    if icon_path:
        try:
            return Image.open(icon_path)
        except Exception as e:
            logger.warning(f"Failed to load icon from {icon_path}: {e}")

    logger.info("Using default generated icon")
    return create_default_icon()


def run_flask_server():
    """Run the Flask server in a separate thread."""
    global flask_server

    # Suppress Flask's default logging for cleaner output
    import logging as flask_logging

    flask_log = flask_logging.getLogger("werkzeug")
    flask_log.setLevel(flask_logging.WARNING)

    logger.info(f"Starting Flask server on {URL}")

    # Use threaded=True for better performance
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)


def open_browser(icon=None, item=None):
    """Open the web browser to the application URL."""
    logger.info(f"Opening browser to {URL}")
    webbrowser.open(URL)


def check_for_updates_tray(icon, item):
    """Check for updates and show notification via system tray."""
    if not requests:
        show_notification(
            icon,
            "Update Check",
            "Update checking is not available (requests package missing)",
        )
        return

    try:
        logger.info("Checking for updates...")
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": f"{APP_NAME}/{VERSION}",
        }

        response = requests.get(GITHUB_API_URL, headers=headers, timeout=10)

        if response.status_code == 404:
            show_notification(
                icon,
                "Up to Date",
                f"You are running {APP_NAME} v{VERSION}\nNo releases available yet.",
            )
            return

        response.raise_for_status()
        release_data = response.json()

        latest_version = release_data.get("tag_name", "").lstrip("v")

        # Compare versions
        def parse_version(v):
            try:
                return tuple(int(x) for x in v.split("."))
            except (ValueError, AttributeError):
                return (0, 0, 0)

        current_ver = parse_version(VERSION)
        latest_ver = parse_version(latest_version)

        if latest_ver > current_ver:
            show_notification(
                icon,
                "Update Available!",
                f"Version {latest_version} is available.\nYou have version {VERSION}.\nVisit the releases page to download.",
            )
            # Open releases page
            webbrowser.open(GITHUB_RELEASES_URL)
        else:
            show_notification(
                icon, "Up to Date", f"You are running the latest version ({VERSION})"
            )

    except requests.exceptions.Timeout:
        show_notification(
            icon, "Update Check Failed", "Request timed out. Please try again."
        )
    except Exception as e:
        logger.error(f"Update check failed: {e}")
        show_notification(icon, "Update Check Failed", f"Error: {str(e)[:50]}")


def show_notification(icon, title, message):
    """Show a system notification."""
    try:
        icon.notify(message, title)
    except Exception as e:
        logger.warning(f"Failed to show notification: {e}")


def exit_app(icon, item):
    """Exit the application."""
    logger.info("Exiting KeyStroker...")

    # Stop the tray icon
    icon.stop()

    # The Flask server will be stopped when the process exits
    # Force exit to ensure clean shutdown
    os._exit(0)


def create_tray_menu():
    """Create the system tray menu."""
    return pystray.Menu(
        item(f"{APP_NAME} v{VERSION}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        item("Open Browser", open_browser, default=True),
        item("Check for Updates", check_for_updates_tray),
        pystray.Menu.SEPARATOR,
        item("Exit", exit_app),
    )


def setup_tray_icon():
    """Set up and run the system tray icon."""
    global tray_icon

    icon_image = load_icon()
    menu = create_tray_menu()

    tray_icon = pystray.Icon(
        APP_NAME, icon_image, f"{APP_NAME} - Keyboard Automation", menu
    )

    return tray_icon


def main():
    """Main entry point for the application."""
    global server_thread, tray_icon

    logger.info("=" * 50)
    logger.info(f"  {APP_NAME} v{VERSION}")
    logger.info("  Keyboard Automation Tool")
    logger.info("=" * 50)

    # Start Flask server in background thread
    server_thread = threading.Thread(target=run_flask_server, daemon=True)
    server_thread.start()

    # Wait a moment for server to start
    time.sleep(1)

    # Auto-open browser
    logger.info("Opening browser automatically...")
    open_browser()

    # Set up and run the system tray icon (blocks until exit)
    logger.info("Starting system tray icon...")
    tray_icon = setup_tray_icon()

    try:
        tray_icon.run()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, exiting...")
        if tray_icon:
            tray_icon.stop()


if __name__ == "__main__":
    main()
