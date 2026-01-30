"""
KeyStroker - Flask Backend
A browser-based keyboard automation tool.
"""

import os
import json
import time
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response
import queue
import threading

import pyautogui

# Import cross-platform window manager
from window_manager import get_all_windows, activate_window, window_exists, get_platform

# Enable failsafe - move mouse to top-left corner to abort
pyautogui.FAILSAFE = True

# Import pyperclip for clipboard-based typing (better keyboard layout support)
try:
    import pyperclip
    PYPERCLIP_AVAILABLE = True
except ImportError:
    PYPERCLIP_AVAILABLE = False

app = Flask(__name__)

# Patterns directory
PATTERNS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "patterns")

# Ensure patterns directory exists
os.makedirs(PATTERNS_DIR, exist_ok=True)

# Global execution state for progress reporting
execution_state = {
    "running": False,
    "current_loop": 0,
    "total_loops": 0,
    "current_step": 0,
    "total_steps": 0,
    "progress_queue": None,
}


def type_text_safe(text, interval=0):
    """
    Type text using clipboard paste method for non-QWERTY keyboard compatibility.
    This works correctly with AZERTY, QWERTZ, and other keyboard layouts.
    Falls back to direct typing if clipboard method fails.
    
    Args:
        text: The text to type
        interval: Delay between characters (only used in fallback mode)
    """
    if not text:
        return
    
    platform = get_platform()
    
    # Try clipboard method first (works with any keyboard layout)
    if PYPERCLIP_AVAILABLE:
        try:
            # Save current clipboard content
            try:
                old_clipboard = pyperclip.paste()
            except Exception:
                old_clipboard = ""
            
            # Copy text to clipboard
            pyperclip.copy(text)
            time.sleep(0.05)  # Small delay for clipboard to update
            
            # Paste using keyboard shortcut
            if platform == 'macos':
                pyautogui.hotkey('command', 'v')
            else:
                pyautogui.hotkey('ctrl', 'v')
            
            time.sleep(0.05)  # Small delay for paste to complete
            
            # Restore original clipboard content
            try:
                if old_clipboard:
                    pyperclip.copy(old_clipboard)
            except Exception:
                pass
            
            return  # Success - exit function
            
        except Exception:
            pass  # Fall through to direct typing
    
    # Fallback: direct typing (may not work correctly with non-QWERTY keyboards)
    pyautogui.write(text, interval=interval)


def count_steps(sequence):
    """Count total steps including nested repeat block children."""
    total = 0
    for step in sequence:
        if step.get("action") == "repeat":
            times = int(step.get("times", 1))
            children = step.get("children", [])
            # Count each repetition of children
            total += count_steps(children) * times
        else:
            total += 1
    return total


def count_total_steps(startup_sequence, main_sequence, loop_count):
    """Count total steps including startup and all loop iterations."""
    startup_steps = count_steps(startup_sequence)
    main_steps = count_steps(main_sequence) * loop_count
    return startup_steps + main_steps


def sanitize_filename(name):
    """Convert pattern name to safe filename."""
    # Remove or replace invalid characters
    safe_name = re.sub(r'[<>:"/\\|?*]', "_", name)
    safe_name = safe_name.strip()
    return safe_name + ".json"


def get_pattern_filepath(name):
    """Get full filepath for a pattern."""
    return os.path.join(PATTERNS_DIR, sanitize_filename(name))


@app.route("/")
def index():
    """Serve the main UI."""
    return render_template("index.html")


@app.route("/mouse-position", methods=["GET"])
def get_mouse_position():
    """Return current mouse cursor position."""
    try:
        x, y = pyautogui.position()
        return jsonify({"x": x, "y": y})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/windows", methods=["GET"])
def get_windows_list():
    """Return list of all visible windows/applications."""
    try:
        windows = get_all_windows()
        platform = get_platform()
        return jsonify({
            "windows": windows,
            "platform": platform,
            "note": "Application names" if platform == "macos" else "Window titles"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def report_progress():
    """Send progress update to SSE clients."""
    if execution_state["progress_queue"]:
        try:
            execution_state["progress_queue"].put_nowait(
                {
                    "type": "progress",
                    "current_loop": execution_state["current_loop"],
                    "total_loops": execution_state["total_loops"],
                    "current_step": execution_state["current_step"],
                    "total_steps": execution_state["total_steps"],
                }
            )
        except queue.Full:
            pass


def execute_step(step, loop_index):
    """
    Execute a single step, handling repeat blocks recursively.

    Args:
        step: The step dictionary containing action and parameters
        loop_index: The current loop iteration (1-based) for {i} replacement
    """
    action = step.get("action")

    if action == "repeat":
        # Repeat block - execute children multiple times
        times = int(step.get("times", 1))
        delay = float(step.get("delay", 0))
        children = step.get("children", [])

        # Skip if times is 0 or no children
        if times <= 0 or not children:
            return

        for r in range(times):
            # Execute all children in order
            for child in children:
                execute_step(child, loop_index)

            # Delay between repetitions (not after the last one)
            if delay > 0 and r < times - 1:
                time.sleep(delay)

    elif action == "type":
        execution_state["current_step"] += 1
        report_progress()
        text = step.get("value", "")
        interval = float(step.get("interval", 0))
        # Replace {i} with current loop index
        text = text.replace("{i}", str(loop_index))
        # Use clipboard-based typing for keyboard layout compatibility (AZERTY, etc.)
        type_text_safe(text, interval=interval)

    elif action == "type_range":
        execution_state["current_step"] += 1
        report_progress()
        start = int(step.get("start", 0))
        end = int(step.get("end", 0))
        interval = float(step.get("interval", 0))
        # Calculate current number with wrap-around
        range_length = end - start + 1
        current_number = start + ((loop_index - 1) % range_length)

        # Apply zero-padding if enabled
        use_padding = step.get("use_padding", False)
        min_digits = int(step.get("min_digits", 1))

        if use_padding and min_digits > 1:
            number_str = str(current_number).zfill(min_digits)
        else:
            number_str = str(current_number)

        # Use clipboard-based typing for keyboard layout compatibility (AZERTY, etc.)
        type_text_safe(number_str, interval=interval)

    elif action == "key":
        execution_state["current_step"] += 1
        report_progress()
        key = step.get("value", "")
        if key:
            pyautogui.press(key)

    elif action == "hotkey":
        execution_state["current_step"] += 1
        report_progress()
        keys = step.get("keys", [])
        if keys:
            pyautogui.hotkey(*keys)
            # Explicitly release modifier keys to prevent them from getting "stuck"
            for key in keys:
                if key.lower() in ["shift", "ctrl", "alt", "win", "command"]:
                    pyautogui.keyUp(key)
            # Small delay to ensure keys are fully released
            time.sleep(0.02)

    elif action == "wait":
        execution_state["current_step"] += 1
        report_progress()
        duration = float(step.get("value", 0))
        time.sleep(duration)

    elif action == "click":
        execution_state["current_step"] += 1
        report_progress()
        button = step.get("button", "left")
        clicks = int(step.get("clicks", 1))
        x = step.get("x")
        y = step.get("y")

        if x is not None and y is not None:
            # Click at specific coordinates
            pyautogui.click(x=int(x), y=int(y), button=button, clicks=clicks)
        else:
            # Click at current mouse position
            pyautogui.click(button=button, clicks=clicks)

    elif action == "move_mouse":
        execution_state["current_step"] += 1
        report_progress()
        x = int(step.get("x", 0))
        y = int(step.get("y", 0))
        duration = float(step.get("duration", 0))
        pyautogui.moveTo(x, y, duration=duration)


@app.route("/run", methods=["POST"])
def run_sequence():
    """Execute the automation sequence."""
    global execution_state

    try:
        data = request.json

        target_window = data.get("target_window")
        target_mode = data.get("target_mode", "manual")
        start_delay = int(data.get("start_delay", 3))
        loop_count = int(data.get("loop_count", 1))
        startup_sequence = data.get("startup_sequence", [])
        sequence = data.get("sequence", [])

        if not sequence and not startup_sequence:
            return jsonify({"error": "Both sequences are empty"}), 400

        # Initialize progress tracking
        total_steps = count_total_steps(startup_sequence, sequence, loop_count)
        execution_state["running"] = True
        execution_state["current_loop"] = 0
        execution_state["total_loops"] = loop_count
        execution_state["current_step"] = 0
        execution_state["total_steps"] = total_steps
        execution_state["progress_queue"] = queue.Queue(maxsize=100)

        # Step 1: Focus target window (if auto mode)
        if target_mode == "auto" and target_window:
            try:
                # Use cross-platform window manager
                if window_exists(target_window):
                    success = activate_window(target_window)
                    if not success:
                        execution_state["running"] = False
                        return jsonify(
                            {"error": f"Failed to activate '{target_window}'. Try selecting it manually."}
                        ), 400
                    time.sleep(0.5)  # Brief pause for window to come to front
                else:
                    execution_state["running"] = False
                    return jsonify(
                        {
                            "error": f"Window '{target_window}' not found. Please refresh the window list."
                        }
                    ), 400
            except Exception as e:
                execution_state["running"] = False
                return jsonify({"error": f"Failed to focus window: {str(e)}"}), 500

        # Step 2: Start delay (handled by frontend with countdown)
        time.sleep(start_delay)

        # Step 3: Execute startup sequence ONCE
        if startup_sequence:
            execution_state["current_loop"] = 0  # 0 indicates startup phase
            for step in startup_sequence:
                execute_step(step, 1)  # loop_index = 1 for startup

        # Step 4: Execute main sequence in loops
        for i in range(1, loop_count + 1):
            execution_state["current_loop"] = i
            for step in sequence:
                execute_step(step, i)

        execution_state["running"] = False

        # Send completion message
        if execution_state["progress_queue"]:
            try:
                execution_state["progress_queue"].put_nowait({"type": "complete"})
            except queue.Full:
                pass

        return jsonify(
            {
                "success": True,
                "message": f"Completed {loop_count} loop(s) successfully!",
            }
        )

    except pyautogui.FailSafeException:
        execution_state["running"] = False
        if execution_state["progress_queue"]:
            try:
                execution_state["progress_queue"].put_nowait({"type": "stopped"})
            except queue.Full:
                pass
        return jsonify(
            {"error": "Emergency stop triggered! Mouse moved to top-left corner."}
        ), 400
    except Exception as e:
        execution_state["running"] = False
        return jsonify({"error": str(e)}), 500


@app.route("/progress")
def progress_stream():
    """Server-Sent Events endpoint for execution progress."""

    def generate():
        while True:
            if execution_state["progress_queue"]:
                try:
                    msg = execution_state["progress_queue"].get(timeout=1)
                    yield f"data: {json.dumps(msg)}\n\n"
                    if msg.get("type") in ["complete", "stopped"]:
                        break
                except queue.Empty:
                    # Send heartbeat
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            else:
                time.sleep(0.1)

    return Response(generate(), mimetype="text/event-stream")


@app.route("/patterns", methods=["GET"])
def list_patterns():
    """List all saved patterns."""
    try:
        patterns = []
        for filename in os.listdir(PATTERNS_DIR):
            if filename.endswith(".json"):
                filepath = os.path.join(PATTERNS_DIR, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        pattern = json.load(f)
                        patterns.append(
                            {
                                "name": pattern.get("name", filename[:-5]),
                                "description": pattern.get("description", ""),
                                "step_count": len(pattern.get("sequence", [])),
                                "loop_count": pattern.get("loop_count", 1),
                                "created_at": pattern.get("created_at", ""),
                                "updated_at": pattern.get("updated_at", ""),
                            }
                        )
                except (json.JSONDecodeError, IOError):
                    continue

        # Sort by updated_at descending (newest first)
        patterns.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return jsonify({"patterns": patterns})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/patterns", methods=["POST"])
def save_pattern():
    """Save a new pattern."""
    try:
        data = request.json
        name = data.get("name", "").strip()

        if not name:
            return jsonify({"error": "Pattern name is required"}), 400

        filepath = get_pattern_filepath(name)

        # Check if pattern already exists
        exists = os.path.exists(filepath)

        # Prepare pattern data
        now = datetime.utcnow().isoformat() + "Z"
        pattern = {
            "name": name,
            "description": data.get("description", ""),
            "created_at": data.get("created_at", now) if exists else now,
            "updated_at": now,
            "target_window": data.get("target_window"),
            "target_mode": data.get("target_mode", "manual"),
            "start_delay": data.get("start_delay", 3),
            "loop_count": data.get("loop_count", 1),
            "default_delay": data.get("default_delay", 0.1),
            "startup_sequence": data.get("startup_sequence", []),
            "sequence": data.get("sequence", []),
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(pattern, f, indent=2, ensure_ascii=False)

        return jsonify(
            {
                "success": True,
                "message": f"Pattern '{name}' saved successfully!",
                "existed": exists,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/patterns/<path:name>", methods=["GET"])
def get_pattern(name):
    """Load a specific pattern."""
    try:
        filepath = get_pattern_filepath(name)

        if not os.path.exists(filepath):
            return jsonify({"error": f"Pattern '{name}' not found"}), 404

        with open(filepath, "r", encoding="utf-8") as f:
            pattern = json.load(f)

        return jsonify(pattern)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/patterns/<path:name>", methods=["PUT"])
def update_pattern(name):
    """Update an existing pattern."""
    try:
        filepath = get_pattern_filepath(name)

        if not os.path.exists(filepath):
            return jsonify({"error": f"Pattern '{name}' not found"}), 404

        # Load existing pattern to preserve created_at
        with open(filepath, "r", encoding="utf-8") as f:
            existing = json.load(f)

        data = request.json
        now = datetime.utcnow().isoformat() + "Z"

        pattern = {
            "name": name,
            "description": data.get("description", existing.get("description", "")),
            "created_at": existing.get("created_at", now),
            "updated_at": now,
            "target_window": data.get("target_window"),
            "target_mode": data.get("target_mode", "manual"),
            "start_delay": data.get("start_delay", 3),
            "loop_count": data.get("loop_count", 1),
            "default_delay": data.get("default_delay", 0.1),
            "startup_sequence": data.get("startup_sequence", []),
            "sequence": data.get("sequence", []),
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(pattern, f, indent=2, ensure_ascii=False)

        return jsonify(
            {"success": True, "message": f"Pattern '{name}' updated successfully!"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/patterns/<path:name>", methods=["DELETE"])
def delete_pattern(name):
    """Delete a pattern."""
    try:
        filepath = get_pattern_filepath(name)

        if not os.path.exists(filepath):
            return jsonify({"error": f"Pattern '{name}' not found"}), 404

        os.remove(filepath)
        return jsonify(
            {"success": True, "message": f"Pattern '{name}' deleted successfully!"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/patterns/<path:name>/duplicate", methods=["POST"])
def duplicate_pattern(name):
    """Duplicate a pattern."""
    try:
        filepath = get_pattern_filepath(name)

        if not os.path.exists(filepath):
            return jsonify({"error": f"Pattern '{name}' not found"}), 404

        # Load existing pattern
        with open(filepath, "r", encoding="utf-8") as f:
            pattern = json.load(f)

        # Generate new name
        base_name = name + " (Copy)"
        new_name = base_name
        counter = 2

        while os.path.exists(get_pattern_filepath(new_name)):
            new_name = f"{base_name} {counter}"
            counter += 1

        # Update pattern data
        now = datetime.utcnow().isoformat() + "Z"
        pattern["name"] = new_name
        pattern["created_at"] = now
        pattern["updated_at"] = now

        # Save new pattern
        new_filepath = get_pattern_filepath(new_name)
        with open(new_filepath, "w", encoding="utf-8") as f:
            json.dump(pattern, f, indent=2, ensure_ascii=False)

        return jsonify(
            {
                "success": True,
                "message": f"Pattern duplicated as '{new_name}'",
                "new_name": new_name,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  KeyStroker - Keyboard Automation Tool")
    print("=" * 50)
    print(f"\n  Platform: {get_platform()}")
    print("\n  Open your browser and go to: http://127.0.0.1:5001")
    print("\n  SAFETY: Move mouse to top-left corner to stop!")
    print("=" * 50 + "\n")
    app.run(debug=True, host="127.0.0.1", port=5001)
