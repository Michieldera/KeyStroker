"""
Script to generate application icons for KeyStroker.
Run this script to create icon.png and icon.ico files.

Requires: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os


def create_keyboard_icon(size=256):
    """Create a keyboard-themed icon."""
    # Create image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Colors
    bg_color = (74, 85, 104)  # Slate gray
    key_color = (255, 255, 255)  # White
    accent_color = (99, 179, 237)  # Light blue

    # Draw rounded rectangle background
    padding = size // 16
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=size // 8,
        fill=bg_color,
    )

    # Draw keyboard keys (3x3 grid representing keys)
    key_margin = size // 5
    key_size = size // 6
    key_gap = size // 16

    start_x = key_margin
    start_y = key_margin + size // 10

    # Top row - 3 keys
    for i in range(3):
        x = start_x + i * (key_size + key_gap)
        draw.rounded_rectangle(
            [x, start_y, x + key_size, start_y + key_size],
            radius=key_size // 6,
            fill=key_color,
        )

    # Middle row - 3 keys (middle one is accent)
    row2_y = start_y + key_size + key_gap
    for i in range(3):
        x = start_x + i * (key_size + key_gap)
        color = accent_color if i == 1 else key_color
        draw.rounded_rectangle(
            [x, row2_y, x + key_size, row2_y + key_size],
            radius=key_size // 6,
            fill=color,
        )

    # Bottom row - space bar
    row3_y = row2_y + key_size + key_gap
    space_width = key_size * 3 + key_gap * 2
    draw.rounded_rectangle(
        [start_x, row3_y, start_x + space_width, row3_y + key_size // 2],
        radius=key_size // 8,
        fill=key_color,
    )

    # Draw a small lightning bolt or "K" to represent automation
    # Using a simple "K" letter
    try:
        # Try to use a font for the letter
        font_size = size // 4
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype(
                    "/System/Library/Fonts/Helvetica.ttc", font_size
                )
            except:
                font = ImageFont.load_default()

        # Draw "K" in bottom right
        text = "K"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = size - padding - text_width - size // 20
        text_y = size - padding - text_height - size // 20

        # Draw text shadow
        draw.text((text_x + 2, text_y + 2), text, font=font, fill=(0, 0, 0, 100))
        # Draw text
        draw.text((text_x, text_y), text, font=font, fill=accent_color)
    except Exception as e:
        print(f"Could not add text: {e}")

    return img


def main():
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Create main icon (256x256)
    icon_256 = create_keyboard_icon(256)

    # Save PNG for tray icon
    png_path = os.path.join(script_dir, "icon.png")
    icon_256.save(png_path, "PNG")
    print(f"Created: {png_path}")

    # Create ICO file with multiple sizes for Windows
    ico_path = os.path.join(script_dir, "icon.ico")

    # Create multiple sizes for ICO
    sizes = [16, 32, 48, 64, 128, 256]
    icons = []
    for size in sizes:
        resized = icon_256.resize((size, size), Image.Resampling.LANCZOS)
        icons.append(resized)

    # Save as ICO
    icon_256.save(ico_path, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"Created: {ico_path}")

    print("\nIcon files created successfully!")


if __name__ == "__main__":
    main()
