"""
Cross-platform window management for KeyStroker.
Handles differences between Windows, macOS, and Linux.
"""
import sys
import subprocess
import time


def get_platform():
    """Detect the current operating system."""
    if sys.platform == 'darwin':
        return 'macos'
    elif sys.platform == 'win32':
        return 'windows'
    return 'linux'


PLATFORM = get_platform()


def get_all_windows():
    """
    Get list of available windows/applications.
    
    Returns:
        list: List of window/application names
    """
    if PLATFORM == 'macos':
        return _get_windows_macos()
    else:
        return _get_windows_pygetwindow()


def activate_window(name):
    """
    Activate/focus a window by name.
    
    Args:
        name: Window or application name to activate
        
    Returns:
        bool: True if successful, False otherwise
    """
    if PLATFORM == 'macos':
        return _activate_macos(name)
    else:
        return _activate_pygetwindow(name)


def window_exists(name):
    """
    Check if a window/application with the given name exists.
    
    Args:
        name: Window or application name to check
        
    Returns:
        bool: True if exists, False otherwise
    """
    windows = get_all_windows()
    # Check for exact match or partial match
    return any(name.lower() in w.lower() or w.lower() in name.lower() for w in windows)


# =============================================================================
# macOS Implementation (using AppleScript)
# =============================================================================

def _get_windows_macos():
    """
    Get all running foreground applications on macOS.
    Uses AppleScript via osascript for reliable results.
    
    Returns:
        list: List of application names
    """
    script = 'tell application "System Events" to get name of every process whose background only is false'
    try:
        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            # Parse comma-separated list
            apps = [a.strip() for a in result.stdout.strip().split(',')]
            # Remove empty strings and duplicates while preserving order
            seen = set()
            unique_apps = []
            for app in apps:
                if app and app not in seen:
                    seen.add(app)
                    unique_apps.append(app)
            return unique_apps
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        pass
    return []


def _activate_macos(app_name):
    """
    Activate an application on macOS using AppleScript.
    
    Args:
        app_name: Name of the application to activate
        
    Returns:
        bool: True if successful, False otherwise
    """
    # First, try direct activation
    script = f'tell application "{app_name}" to activate'
    try:
        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            time.sleep(0.3)  # Brief pause for window to come to front
            return True
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        pass
    
    # Fallback: try using System Events
    script2 = f'''
    tell application "System Events"
        set frontmost of process "{app_name}" to true
    end tell
    '''
    try:
        result = subprocess.run(
            ['osascript', '-e', script2],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            time.sleep(0.3)
            return True
    except Exception:
        pass
    
    return False


# =============================================================================
# Windows/Linux Implementation (using pygetwindow)
# =============================================================================

def _get_windows_pygetwindow():
    """
    Get all window titles using pygetwindow.
    Works on Windows and Linux.
    
    Returns:
        list: List of window titles
    """
    try:
        import pygetwindow as gw
        windows = gw.getAllTitles()
        # Filter out empty titles and remove duplicates
        seen = set()
        unique_windows = []
        for w in windows:
            w = w.strip()
            if w and w not in seen:
                seen.add(w)
                unique_windows.append(w)
        return unique_windows
    except ImportError:
        return []
    except Exception:
        return []


def _activate_pygetwindow(name):
    """
    Activate a window using pygetwindow.
    Works on Windows and Linux.
    
    Args:
        name: Window title to activate
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        import pygetwindow as gw
        windows = gw.getWindowsWithTitle(name)
        if windows:
            win = windows[0]
            # Restore if minimized
            if hasattr(win, 'isMinimized') and win.isMinimized:
                win.restore()
            # Activate
            try:
                win.activate()
            except Exception as e:
                # Ignore "Error code 0" which actually means success on Windows
                if "Error code from Windows: 0" not in str(e):
                    return False
            time.sleep(0.3)  # Brief pause for window to come to front
            return True
    except ImportError:
        pass
    except Exception:
        pass
    return False


# =============================================================================
# Utility Functions
# =============================================================================

def get_platform_info():
    """
    Get information about the current platform and available features.
    
    Returns:
        dict: Platform information
    """
    return {
        'platform': PLATFORM,
        'python_version': sys.version,
        'window_method': 'AppleScript' if PLATFORM == 'macos' else 'pygetwindow',
        'features': {
            'list_windows': True,
            'activate_window': True,
            'window_titles': PLATFORM != 'macos',  # macOS only gets app names
            'app_names': True
        }
    }
