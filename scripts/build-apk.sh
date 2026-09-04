#!/bin/bash
set -e

# Route to node script if node is present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if command -v node &>/dev/null; then
    node "$SCRIPT_DIR/scripts/export-apk.js"
    exit 0
fi

echo "Running bash builder fallback..."
# Fallback bash execution
VERSION=$(node -p "require('$SCRIPT_DIR/package.json').version || '1.0.1'" 2>/dev/null || echo "1.0.1")
DEST_DIR="/mnt/d/EduNex-app"
[ ! -d "$DEST_DIR" ] && DEST_DIR="D:/EduNex-app"
mkdir -p "$DEST_DIR" 2>/dev/null || true

cd "$SCRIPT_DIR/android"
./gradlew assembleRelease
cd "$SCRIPT_DIR"

SRC_APK="android/app/build/outputs/apk/release/app-arm64-v8a-release.apk"
[ ! -f "$SRC_APK" ] && SRC_APK="android/app/build/outputs/apk/release/app-release.apk"

TARGET_APK="EduNex V${VERSION}.apk"
cp -f "$SRC_APK" "$DEST_DIR/$TARGET_APK"
cp -f "$SRC_APK" "$DEST_DIR/EduNex.apk"

if [ -d "$DEST_DIR/.git" ]; then
    cd "$DEST_DIR"
    git add .
    git commit -m "Release: v${VERSION} - Update $TARGET_APK (_v8a-release) & download portal" || true
    git push origin main || true
fi
