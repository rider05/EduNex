const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("========================================");
console.log("🚀 EduNex Release APK Builder & Exporter");
console.log("========================================");

// 1. Read app version from package.json
const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const version = pkg.version || "1.0.1";
console.log(`📦 Target Version: v${version}`);

// 2. Build Release APK via Gradle
console.log("\n⚡ Running Gradle Release Build...");
const androidDir = path.join(__dirname, "..", "android");
const isWindows = process.platform === "win32";
const gradlewCmd = isWindows ? "gradlew.bat assembleRelease" : "./gradlew assembleRelease";

try {
  execSync(gradlewCmd, {
    cwd: androidDir,
    stdio: "inherit",
  });
} catch (err) {
  console.error("❌ Gradle build failed:", err.message);
  process.exit(1);
}

// 3. Find generated APK
const apkDir = path.join(androidDir, "app", "build", "outputs", "apk", "release");
const candidates = [
  path.join(apkDir, "app-arm64-v8a-release.apk"),
  path.join(apkDir, "app-universal-release.apk"),
  path.join(apkDir, "app-release.apk"),
];

let sourceApk = candidates.find((f) => fs.existsSync(f));
if (!sourceApk) {
  console.error("❌ No built APK found in:", apkDir);
  process.exit(1);
}

// 4. Ensure destination D:/EduNex-app exists
const destDir = "D:\\EduNex-app";
if (!fs.existsSync(destDir)) {
  try {
    fs.mkdirSync(destDir, { recursive: true });
  } catch (err) {
    console.warn(`Could not create ${destDir}, falling back to local folder.`);
  }
}

const finalDestDir = fs.existsSync(destDir) ? destDir : path.join(__dirname, "..", "dist-apk");
if (!fs.existsSync(finalDestDir)) fs.mkdirSync(finalDestDir, { recursive: true });

const targetFileName = `EduNex V${version}.apk`;
const targetFilePath = path.join(finalDestDir, targetFileName);

// 5. Rewrite/Copy APK
console.log(`\n📁 Rewriting and saving versioned APK to:\n👉 ${targetFilePath}`);
fs.copyFileSync(sourceApk, targetFilePath);

const stats = fs.statSync(targetFilePath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n========================================");
console.log(`✅ SUCCESS! Exported APK: ${targetFileName} (${sizeMB} MB)`);
console.log(`📍 Location: ${targetFilePath}`);
console.log("========================================\n");
