# AutoKey Web (KeyStroker)

A browser-based keyboard and mouse automation tool with a visual drag-and-drop interface. Build, save, and execute automation sequences without writing code.

## Features

### Automation Actions
- **Type Text** - Type strings with customizable speed. Use `{i}` to insert the current loop number
- **Type Number Range** - Type incrementing numbers across loops (e.g., 1-100) with optional zero-padding
- **Press Key** - Press individual keys (Enter, Tab, Arrow keys, Function keys, etc.)
- **Hotkey Combo** - Execute keyboard shortcuts (e.g., Ctrl+C, Ctrl+Shift+S)
- **Mouse Click** - Left/right/middle click at current position or specific coordinates
- **Move Mouse** - Move cursor to specific screen coordinates
- **Wait** - Pause execution for a specified duration
- **Repeat Block** - Nest actions inside a loop to repeat them multiple times

### Workflow Features
- **Startup Sequence** - Actions that run once before the main loop begins
- **Main Loop** - Actions that repeat for the specified number of iterations
- **Target Window** - Auto-focus a specific application window or use manual mode
- **Pattern Management** - Save, load, duplicate, and delete automation patterns
- **JSON Import/Export** - Share patterns as JSON files
- **Undo/Redo** - Full history support for sequence editing
- **Dark Mode** - Toggle between light and dark themes

### Safety
- **Emergency Stop**: Move your mouse to the top-left corner of the screen to immediately abort execution (pyautogui failsafe)
- **Start Delay**: Configurable countdown before execution begins
- **Confirmation Modal**: Review settings before running

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd KeyStroker
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On macOS/Linux
   # or
   .venv\Scripts\activate     # On Windows
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

### Platform-Specific Notes

#### macOS
You may need to grant accessibility permissions to your terminal application:
1. Go to **System Preferences > Security & Privacy > Privacy > Accessibility**
2. Add your terminal application (Terminal, iTerm2, VS Code, etc.)

#### Linux
Install the required system packages:
```bash
# Debian/Ubuntu
sudo apt-get install python3-tk python3-dev scrot

# Fedora
sudo dnf install python3-tkinter python3-devel
```

#### Windows
No additional setup required. Dependencies install via pip.

## Usage

### Starting the Application

```bash
python app.py
```

The server starts at `http://127.0.0.1:5000`. Open this URL in your browser.

### Building a Sequence

1. **Drag actions** from the Toolbox panel on the left
2. **Drop them** into the Sequence panel on the right
3. **Configure each action** using the input fields
4. **Reorder** by dragging items up/down
5. **Delete** items by hovering and clicking the red X button

### Using Repeat Blocks

Repeat blocks allow you to nest multiple actions that execute N times:

1. Drag a "Repeat Block" into your sequence
2. Drag other actions into the repeat block's drop zone
3. Set the number of repetitions and delay between iterations

> Note: Repeat blocks cannot be nested inside other repeat blocks.

### Startup vs Main Loop

Use the tabs above the sequence area to switch between:
- **Startup (Once)** - Actions that run once at the beginning
- **Main Loop** - Actions that repeat for each loop iteration

### Target Window Modes

- **Auto-focus**: Select a window from the dropdown. The app will automatically bring it to the foreground before execution.
- **Manual mode**: Switch to your target application during the start delay countdown.

### Saving Patterns

1. Click "Save Pattern"
2. Enter a name and optional description
3. Choose whether to include current settings
4. Click "Save Pattern"

Patterns are stored as JSON files in the `patterns/` directory.

### Loop Variables

Use `{i}` in text fields to insert the current loop number:
- Loop 1: `{i}` becomes `1`
- Loop 2: `{i}` becomes `2`
- etc.

Example: Type `Item_{i}` with 3 loops produces: `Item_1`, `Item_2`, `Item_3`

### Number Range Typing

The "Type Number Range" action types a number that increments with each loop:
- Set **From** and **To** values
- Enable **Min digits** for zero-padding (e.g., 01, 02, 03)
- Numbers wrap around when they exceed the range

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serve the main UI |
| GET | `/mouse-position` | Get current mouse coordinates |
| GET | `/windows` | List all visible window titles |
| POST | `/run` | Execute an automation sequence |
| GET | `/progress` | SSE endpoint for execution progress |
| GET | `/patterns` | List all saved patterns |
| POST | `/patterns` | Save a new pattern |
| GET | `/patterns/<name>` | Load a specific pattern |
| PUT | `/patterns/<name>` | Update an existing pattern |
| DELETE | `/patterns/<name>` | Delete a pattern |
| POST | `/patterns/<name>/duplicate` | Duplicate a pattern |

### Sequence Format

```json
{
  "name": "Example Pattern",
  "description": "Optional description",
  "target_window": "Application Name",
  "target_mode": "auto",
  "start_delay": 3,
  "loop_count": 10,
  "startup_sequence": [],
  "sequence": [
    {
      "action": "type",
      "value": "Hello {i}",
      "interval": 0.05
    },
    {
      "action": "key",
      "value": "enter"
    },
    {
      "action": "wait",
      "value": 0.5
    },
    {
      "action": "repeat",
      "times": 3,
      "delay": 0.1,
      "children": [
        {"action": "key", "value": "tab"}
      ]
    }
  ]
}
```

### Action Types

| Action | Parameters |
|--------|------------|
| `type` | `value` (text), `interval` (typing speed in seconds) |
| `type_range` | `start`, `end`, `interval`, `use_padding`, `min_digits` |
| `key` | `value` (key name) |
| `hotkey` | `keys` (array of key names) |
| `wait` | `value` (duration in seconds) |
| `click` | `button`, `clicks`, `x`, `y` (optional coordinates) |
| `move_mouse` | `x`, `y`, `duration` |
| `repeat` | `times`, `delay`, `children` (array of actions) |

## Project Structure

```
KeyStroker/
├── app.py              # Flask backend
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html      # Main UI template
├── static/
│   ├── style.css       # Styling (light/dark themes)
│   └── script.js       # Frontend logic
├── patterns/           # Saved automation patterns (JSON)
└── README.md           # This file
```

## Dependencies

- **Flask** - Web framework
- **pyautogui** - Keyboard/mouse automation
- **PyGetWindow** - Window management (focus, list windows)

## Troubleshooting

### "Permission denied" or automation not working (macOS)
Grant accessibility permissions to your terminal in System Preferences.

### Window not found
Click the refresh button next to the window dropdown to update the list.

### Execution stops unexpectedly
The failsafe was triggered. Your mouse moved to the top-left corner.

### Keys getting "stuck"
This can happen if execution is interrupted. Press the stuck modifier key (Ctrl, Alt, Shift) to release it.

## License

MIT License

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
