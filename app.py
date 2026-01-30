"""
AutoKey Web - Flask Backend
A browser-based keyboard automation tool.
"""

import os
import json
import time
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify

import pyautogui
import pygetwindow as gw

# Enable failsafe - move mouse to top-left corner to abort
pyautogui.FAILSAFE = True

app = Flask(__name__)

# Patterns directory
PATTERNS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "patterns")

# Ensure patterns directory exists
os.makedirs(PATTERNS_DIR, exist_ok=True)


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


@app.route("/windows", methods=["GET"])
def get_windows():
    """Return list of all visible window titles."""
    try:
        windows = gw.getAllTitles()
        # Filter out empty titles
        windows = [w for w in windows if w.strip()]
        # Remove duplicates while preserving order
        seen = set()
        unique_windows = []
        for w in windows:
            if w not in seen:
                seen.add(w)
                unique_windows.append(w)
        return jsonify({"windows": unique_windows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/run", methods=["POST"])
def run_sequence():
    """Execute the automation sequence."""
    try:
        data = request.json

        target_window = data.get("target_window")
        target_mode = data.get("target_mode", "manual")
        start_delay = int(data.get("start_delay", 3))
        loop_count = int(data.get("loop_count", 1))
        sequence = data.get("sequence", [])

        if not sequence:
            return jsonify({"error": "Sequence is empty"}), 400

        # Step 1: Focus target window (if auto mode)
        if target_mode == "auto" and target_window:
            try:
                windows = gw.getWindowsWithTitle(target_window)
                if windows:
                    target = windows[0]
                    # Restore if minimized
                    if target.isMinimized:
                        target.restore()
                    target.activate()
                    time.sleep(0.5)  # Brief pause for window to come to front
                else:
                    return jsonify(
                        {
                            "error": f"Window '{target_window}' not found. Please refresh the window list."
                        }
                    ), 400
            except Exception as e:
                return jsonify({"error": f"Failed to focus window: {str(e)}"}), 500

        # Step 2: Start delay
        time.sleep(start_delay)

        # Step 3: Execute sequence in loops
        for i in range(1, loop_count + 1):
            for step in sequence:
                action = step.get("action")

                if action == "type":
                    text = step.get("value", "")
                    interval = float(step.get("interval", 0))
                    # Replace {i} with current loop index
                    text = text.replace("{i}", str(i))
                    pyautogui.write(text, interval=interval)

                elif action == "type_range":
                    start = int(step.get("start", 0))
                    end = int(step.get("end", 0))
                    interval = float(step.get("interval", 0))
                    # Calculate current number with wrap-around
                    range_length = end - start + 1
                    current_number = start + ((i - 1) % range_length)
                    pyautogui.write(str(current_number), interval=interval)

                elif action == "key":
                    key = step.get("value", "")
                    if key:
                        pyautogui.press(key)

                elif action == "hotkey":
                    keys = step.get("keys", [])
                    if keys:
                        pyautogui.hotkey(*keys)

                elif action == "wait":
                    duration = float(step.get("value", 0))
                    time.sleep(duration)

        return jsonify(
            {
                "success": True,
                "message": f"Completed {loop_count} loop(s) successfully!",
            }
        )

    except pyautogui.FailSafeException:
        return jsonify(
            {"error": "Emergency stop triggered! Mouse moved to top-left corner."}
        ), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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


@app.route("/patterns/<name>", methods=["GET"])
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


@app.route("/patterns/<name>", methods=["PUT"])
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
            "sequence": data.get("sequence", []),
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(pattern, f, indent=2, ensure_ascii=False)

        return jsonify(
            {"success": True, "message": f"Pattern '{name}' updated successfully!"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/patterns/<name>", methods=["DELETE"])
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


@app.route("/patterns/<name>/duplicate", methods=["POST"])
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
    print("  AutoKey Web - Keyboard Automation Tool")
    print("=" * 50)
    print("\n  Open your browser and go to: http://127.0.0.1:5000")
    print("\n  SAFETY: Move mouse to top-left corner to stop!")
    print("=" * 50 + "\n")
    app.run(debug=True, host="127.0.0.1", port=5000)
