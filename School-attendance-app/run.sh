#!/bin/bash

echo "🎓 School Attendance App"
echo "========================"
echo ""
echo "Available devices:"
flutter devices
echo ""
echo "Choose how to run:"
echo "1. Chrome (Web)"
echo "2. macOS Desktop"
echo "3. iOS Simulator"
echo "4. Android Emulator"
echo "5. Auto-select"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "Starting on Chrome..."
        flutter run -d chrome
        ;;
    2)
        echo "Starting on macOS..."
        flutter run -d macos
        ;;
    3)
        echo "Starting on iOS Simulator..."
        flutter run -d ios
        ;;
    4)
        echo "Starting on Android Emulator..."
        flutter run -d android
        ;;
    5)
        echo "Auto-selecting device..."
        flutter run
        ;;
    *)
        echo "Invalid choice. Running with auto-select..."
        flutter run
        ;;
esac
