#!/bin/bash
set -e

echo "=== EduNex - WSL Android Build Environment Setup ==="
echo ""

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# --- 1. System packages ---
echo -e "${YELLOW}[1/6] Installing system packages...${NC}"
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk-headless unzip wget curl git build-essential

# Verify JDK
java_version=$(java -version 2>&1 | head -n 1)
echo -e "${GREEN}Installed: $java_version${NC}"

# --- 2. Android SDK ---
echo -e "${YELLOW}[2/6] Setting up Android SDK...${NC}"

ANDROID_HOME="$HOME/android-sdk"
ANDROID_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Downloading Android command-line tools..."
    cd /tmp
    wget -q "$ANDROID_TOOLS_URL" -O cmdline-tools.zip
    unzip -q -o cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools/"
    mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -f cmdline-tools.zip
    echo -e "${GREEN}Android cmdline-tools installed.${NC}"
else
    echo -e "${GREEN}Android cmdline-tools already installed.${NC}"
fi

export ANDROID_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# --- 3. Accept licenses & install SDK components ---
echo -e "${YELLOW}[3/6] Installing SDK components (platform-tools, build-tools, platform 35, NDK, CMake)...${NC}"

yes | sdkmanager --licenses > /dev/null 2>&1 || true

sdkmanager --install \
    "platform-tools" \
    "build-tools;35.0.0" \
    "platforms;android-35" \
    "ndk;27.1.12297006" \
    "cmake;3.22.1" \
    2>&1 | tail -5

echo -e "${GREEN}SDK components installed.${NC}"

# --- 4. Environment variables ---
echo -e "${YELLOW}[4/6] Configuring environment variables...${NC}"

SHELL_RC="$HOME/.bashrc"
[ -n "$ZSH_VERSION" ] && SHELL_RC="$HOME/.zshrc"

# Remove old entries if any, then append
sed -i '/# EduNex Android SDK/d' "$SHELL_RC" 2>/dev/null || true
sed -i '/ANDROID_HOME/d' "$SHELL_RC" 2>/dev/null || true
sed -i '/JAVA_HOME/d' "$SHELL_RC" 2>/dev/null || true

cat >> "$SHELL_RC" << 'ENVEOF'

# EduNex Android SDK
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/ndk/27.1.12297006:$PATH
export PATH=$JAVA_HOME/bin:$PATH
ENVEOF

# Export for current session
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

echo -e "${GREEN}Environment variables written to $SHELL_RC${NC}"

# --- 5. Verify everything ---
echo -e "${YELLOW}[5/6] Verifying installation...${NC}"

echo -n "Java: "; java -version 2>&1 | head -n1
echo -n "ADB:  "; adb --version 2>&1 | head -n1
echo -n "SDK:  "; sdkmanager --version 2>&1
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

# --- 6. Done ---
echo ""
echo -e "${GREEN}[6/6] Setup complete!${NC}"
echo ""
echo "To build your APK, run:"
echo "  cd /mnt/d/edunex"
echo "  npm install"
echo "  npx expo prebuild --platform android   # if android/ doesn't exist"
echo "  cd android && ./gradlew assembleRelease"
echo ""
echo "Output APK will be at:"
echo "  android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "For debug APK:"
echo "  cd android && ./gradlew assembleDebug"
echo ""
