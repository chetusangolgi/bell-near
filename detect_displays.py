"""
Display Detection Script
Detects all connected monitors and their properties
Run this to find Display IDs for your folder configuration
"""

import sys

try:
    import win32api
    import win32con
    from win32api import GetSystemMetrics
except ImportError:
    print("ERROR: pywin32 is not installed!")
    print("\nTo install, run:")
    print("  pip install pywin32")
    print("\nOr:")
    print("  python -m pip install pywin32")
    sys.exit(1)


def get_display_info():
    """Get information about all connected displays"""
    displays = []

    # Enumerate all display devices
    device_num = 0
    while True:
        try:
            device = win32api.EnumDisplayDevices(None, device_num)
            if not device:
                break

            # Only process active displays
            if device.StateFlags & win32con.DISPLAY_DEVICE_ATTACHED_TO_DESKTOP:
                # Get display settings
                try:
                    settings = win32api.EnumDisplaySettings(device.DeviceName, win32con.ENUM_CURRENT_SETTINGS)

                    display_info = {
                        'index': device_num,
                        'device_name': device.DeviceName,
                        'device_string': device.DeviceString,
                        'device_id': device.DeviceID,
                        'device_key': device.DeviceKey,
                        'width': settings.PelsWidth,
                        'height': settings.PelsHeight,
                        'position_x': settings.Position_x,
                        'position_y': settings.Position_y,
                        'frequency': settings.DisplayFrequency,
                        'bits_per_pixel': settings.BitsPerPel,
                        'orientation': settings.DisplayOrientation,
                        'is_primary': bool(device.StateFlags & win32con.DISPLAY_DEVICE_PRIMARY_DEVICE),
                        'state_flags': device.StateFlags
                    }

                    displays.append(display_info)
                except:
                    pass

            device_num += 1
        except:
            break

    return displays


def get_orientation_name(orientation):
    """Convert orientation code to readable name"""
    orientations = {
        0: 'Landscape (0°)',
        1: 'Portrait (90°)',
        2: 'Landscape Flipped (180°)',
        3: 'Portrait Flipped (270°)'
    }
    return orientations.get(orientation, f'Unknown ({orientation}°)')


def extract_display_id(device_id):
    """Extract a simpler ID from the device ID string"""
    # Try to extract a unique identifier from the device ID
    # Example: \\?\DISPLAY#GSM5BBB#...
    try:
        parts = device_id.split('#')
        if len(parts) >= 3:
            return f"{parts[1]}_{parts[2]}"
        return device_id.split('\\')[-1]
    except:
        return "UNKNOWN"


def print_display_report(displays):
    """Print a formatted report of all displays"""

    print("\n" + "=" * 80)
    print(" " * 25 + "DISPLAY DETECTION REPORT")
    print("=" * 80 + "\n")

    print(f"Total Displays Found: {len(displays)}\n")

    for display in displays:
        primary_text = " (PRIMARY)" if display['is_primary'] else ""
        orientation = "Landscape" if display['width'] > display['height'] else \
                     "Portrait" if display['width'] < display['height'] else "Square"

        print("┌" + "─" * 78 + "┐")
        print(f"│ Display {display['index']}{primary_text:<70}│")
        print("└" + "─" * 78 + "┘")

        # Extract simpler ID
        simple_id = extract_display_id(display['device_id'])

        print(f"  Monitor Name:       {display['device_string']}")
        print(f"  Device Name:        {display['device_name']}")
        print(f"  Simple ID:          {simple_id}")
        print(f"  Resolution:         {display['width']}x{display['height']}")
        print(f"  Orientation:        {orientation} ({get_orientation_name(display['orientation'])})")
        print(f"  Position:           x:{display['position_x']}, y:{display['position_y']}")
        print(f"  Refresh Rate:       {display['frequency']} Hz")
        print(f"  Color Depth:        {display['bits_per_pixel']}-bit")
        print(f"  Primary Display:    {'Yes' if display['is_primary'] else 'No'}")
        print(f"\n  Full Device ID:")
        print(f"    {display['device_id']}")
        print(f"\n  Registry Key:")
        print(f"    {display['device_key']}")
        print()

    print("=" * 80)
    print(" " * 25 + "FOLDER NAME SUGGESTIONS")
    print("=" * 80 + "\n")

    print("Create these folders in C:\\ for your videos:\n")

    for display in displays:
        simple_id = extract_display_id(display['device_id'])
        orientation = "landscape" if display['width'] > display['height'] else \
                     "portrait" if display['width'] < display['height'] else "square"

        print(f"Display {display['index']}: {display['device_string']} ({display['width']}x{display['height']} {orientation})")
        print(f"  C:\\{simple_id}_default\\video.mp4")
        print(f"  C:\\{simple_id}_trigger\\video.mp4")
        print()

    print("=" * 80)
    print(" " * 22 + "CONFIGURATION FOR main.js")
    print("=" * 80 + "\n")

    print("Add this to DISPLAY_VIDEO_CONFIG in main.js:\n")
    print("const DISPLAY_VIDEO_CONFIG = {")

    for display in displays:
        simple_id = extract_display_id(display['device_id'])
        orientation = "landscape" if display['width'] > display['height'] else \
                     "portrait" if display['width'] < display['height'] else "square"
        print(f"  // {display['device_string']} ({display['width']}x{display['height']} {orientation})")
        print(f"  '{simple_id}': 'your_custom_name',")
        print()

    print("};\n")

    print("=" * 80)
    print(" " * 20 + "ALTERNATIVE IDENTIFICATION METHODS")
    print("=" * 80 + "\n")

    print("Option 1: By Simple ID (Extracted from Device ID)")
    print("const DISPLAY_VIDEO_CONFIG = {")
    for display in displays:
        simple_id = extract_display_id(display['device_id'])
        print(f"  '{simple_id}': 'folder_name',")
    print("};\n")

    print("Option 2: By Resolution")
    print("const DISPLAY_VIDEO_CONFIG = {")
    for display in displays:
        print(f"  '{display['width']}x{display['height']}': 'folder_name',")
    print("};\n")

    print("Option 3: By Position")
    print("const DISPLAY_VIDEO_CONFIG = {")
    for display in displays:
        print(f"  'x{display['position_x']}_y{display['position_y']}': 'folder_name',")
    print("};\n")

    print("Option 4: By Monitor Name (only if different)")
    print("const DISPLAY_VIDEO_CONFIG = {")
    for display in displays:
        print(f"  '{display['device_string']}': 'folder_name',")
    print("};\n")

    print("=" * 80 + "\n")


def main():
    print("\n🖥️  Detecting connected displays...")

    displays = get_display_info()

    if not displays:
        print("\n❌ ERROR: No displays detected!")
        print("Make sure your monitors are connected and turned on.")
        sys.exit(1)

    print(f"✅ Found {len(displays)} display(s)")

    print_display_report(displays)

    print("Detection complete!")
    print("\n💡 TIP: Use the Simple ID or Resolution for your folder names")
    print("   The Simple ID is stable and unique for each monitor.\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nDetection cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        print("\nIf you see import errors, install pywin32:")
        print("  pip install pywin32")
        sys.exit(1)
