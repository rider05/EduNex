#!/bin/bash
set -e

# EduNex APK Builder & Versioned Exporter
# Usage: ./scripts/build-apk.sh [release|debug]

BUILD_TYPE="${1:-release}"

echo "========================================"
echo "🚀 EduNex APK Builder & Exporter"
echo "Build Mode: $BUILD_TYPE"
echo "========================================"
echo ""

# Extract current version from package.json or app.json
VERSION=$(node -p "require('./package.json').version || '1.0.1'" 2>/dev/null || echo "1.0.1")
echo "📦 Detected App Version: v$VERSION"
echo ""

# Ensure env vars are set if in Linux/WSL
if [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then
    export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
    export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
    export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
fi

if [ ! -d "android" ]; then
    echo "android/ directory not found. Running prebuild..."
    npx expo prebuild --platform android
fi

echo "Building APK ($BUILD_TYPE)..."
cd android

if [ "$BUILD_TYPE" = "debug" ]; then
    if [ -f "./gradlew" ]; then
        ./gradlew assembleDebug
    else
        gradlew.bat assembleDebug
    fi
    SRC_APK="app/build/outputs/apk/debug/app-debug.apk"
else
    if [ -f "./gradlew" ]; then
        ./gradlew assembleRelease
    else
        gradlew.bat assembleRelease
    fi
    # Check for optimized arm64-v8a split APK first, then universal/standard
    if [ -f "app/build/outputs/apk/release/app-arm64-v8a-release.apk" ]; then
        SRC_APK="app/build/outputs/apk/release/app-arm64-v8a-release.apk"
    elif [ -f "app/build/outputs/apk/release/app-universal-release.apk" ]; then
        SRC_APK="app/build/outputs/apk/release/app-universal-release.apk"
    else
        SRC_APK="app/build/outputs/apk/release/app-release.apk"
    fi
fi

cd ..

echo ""
echo "========================================"
echo "📁 Moving & Rewriting Versioned APK..."
echo "========================================"

# Determine destination paths (WSL vs Git Bash vs Windows native)
DEST_DIRS=(
  "/mnt/d/EduNex-app"
  "/d/EduNex-app"
  "D:/EduNex-app"
  "D:\\EduNex-app"
)

DEST_DIR=""
for d in "${DEST_DIRS[@]}"; do
  if mkdir -p "$d" 2>/dev/null; then
    DEST_DIR="$d"
    break
  fi
done

if [ -z "$DEST_DIR" ]; then
  DEST_DIR="D:/EduNex-app"
  mkdir -p "$DEST_DIR" 2>/dev/null || true
fi

TARGET_APK_NAME="EduNex V${VERSION}.apk"

if [ -f "android/$SRC_APK" ]; then
    # Remove any existing copy to guarantee a clean rewrite
    rm -f "$DEST_DIR/$TARGET_APK_NAME" 2>/dev/null || true
    
    # Copy fresh APK
    cp -f "android/$SRC_APK" "$DEST_DIR/$TARGET_APK_NAME"
    
    echo "✅ SUCCESS: Built and saved versioned APK!"
    echo "📍 File Path: D:/EduNex-app/$TARGET_APK_NAME"
    if command -v ls &>/dev/null; then
        ls -lh "$DEST_DIR/$TARGET_APK_NAME"
    fi
else
    echo "❌ ERROR: Built APK not found at android/$SRC_APK"
    exit 1
fi
