#!/bin/bash
set -e

# EduNex APK Builder (for WSL)
# Usage: ./scripts/build-apk.sh [release|debug]

BUILD_TYPE="${1:-release}"

echo "=== EduNex APK Builder ==="
echo "Build type: $BUILD_TYPE"
echo ""

# Ensure env vars are set
export JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}
export ANDROID_HOME=${ANDROID_HOME:-$HOME/android-sdk}
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# Verify prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Install it with:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo "ERROR: Java not found. Run setup-wsl-android.sh first."
    exit 1
fi

if [ ! -d "android" ]; then
    echo "android/ directory not found. Running prebuild..."
    npx expo prebuild --platform android
fi

echo ""
echo "Installing npm dependencies..."
npm install

echo ""
echo "Building APK ($BUILD_TYPE)..."
cd android

if [ "$BUILD_TYPE" = "debug" ]; then
    ./gradlew assembleDebug --no-daemon
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
else
    ./gradlew assembleRelease --no-daemon
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
fi

cd ..

echo ""
echo "=== Build Complete ==="
if [ -f "android/$APK_PATH" ]; then
    echo "APK location: android/$APK_PATH"
    ls -lh "android/$APK_PATH"
else
    echo "WARNING: APK not found at expected path. Check build output above."
fi
