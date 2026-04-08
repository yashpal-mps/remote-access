#!/bin/bash

# Fix script for "Capture It.app can't be opened" on macOS
# This script removes quarantine attributes and re-signs the app

set -e

APP_NAME="Capture It.app"

# Check if app path is provided
if [ -z "$1" ]; then
    # Try to find the app in common locations
    if [ -d "/Applications/$APP_NAME" ]; then
        APP_PATH="/Applications/$APP_NAME"
    elif [ -d "$HOME/Applications/$APP_NAME" ]; then
        APP_PATH="$HOME/Applications/$APP_NAME"
    else
        echo "Usage: $0 <path to Capture It.app>"
        echo "Example: $0 /Applications/Capture\\ It.app"
        echo ""
        echo "Or drag the app into this terminal window after the command"
        exit 1
    fi
else
    APP_PATH="$1"
fi

echo "Fixing: $APP_PATH"
echo ""

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "Error: App not found at $APP_PATH"
    exit 1
fi

# Remove quarantine attributes
echo "Step 1: Removing quarantine attributes..."
sudo xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || echo "  No quarantine attributes found (good!)"

# Remove com.apple.quarantine extended attribute from specific files
echo "Step 2: Cleaning extended attributes..."
sudo xattr -c "$APP_PATH" 2>/dev/null || xattr -c "$APP_PATH" 2>/dev/null || true

# Re-sign the app with ad-hoc signature
echo "Step 3: Re-signing the app..."
codesign --force --deep --sign - "$APP_PATH"

# Verify signature
echo "Step 4: Verifying signature..."
codesign -dv "$APP_PATH" 2>&1 | grep -E "(Signature|Authority)" || true

echo ""
echo "✅ Fix complete!"
echo ""
echo "You can now open the app by:"
echo "  1. Right-clicking on the app"
echo "  2. Selecting 'Open'"
echo "  3. Clicking 'Open' in the dialog"
echo ""
echo "First time only: You may need to grant permissions:"
echo "  - Screen Recording: System Preferences → Security & Privacy → Privacy → Screen Recording"
echo "  - Accessibility: System Preferences → Security & Privacy → Privacy → Accessibility"
echo ""
