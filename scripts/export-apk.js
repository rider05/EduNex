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

// 2. Determine destination D:/EduNex-app and check if file already exists
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

console.log("\n🔍 Checking destination for existing file...");
if (fs.existsSync(targetFilePath)) {
  const existingStats = fs.statSync(targetFilePath);
  const oldSizeMB = (existingStats.size / (1024 * 1024)).toFixed(2);
  const modifiedTime = existingStats.mtime.toLocaleString();
  console.log(`⚠️ Existing file found: ${targetFileName}`);
  console.log(`   Size: ${oldSizeMB} MB | Last modified: ${modifiedTime}`);
  console.log(`♻️ It will be safely rewritten with the fresh build.`);
} else {
  console.log(`✨ No existing file found for ${targetFileName} (Will create fresh).`);
}

// 3. Build Release APK via Gradle
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

// 4. Find generated APK
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

// 5. Rewrite/Copy APK
console.log(`\n📁 Rewriting and saving versioned APK to:\n👉 ${targetFilePath}`);
if (fs.existsSync(targetFilePath)) {
  try {
    fs.unlinkSync(targetFilePath);
  } catch (_e) {
    // Overwrite directly via copy
  }
}

fs.copyFileSync(sourceApk, targetFilePath);

const stats = fs.statSync(targetFilePath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n========================================");
console.log(`✅ SUCCESS! Exported APK: ${targetFileName} (${sizeMB} MB)`);
console.log(`📍 Location: ${targetFilePath}`);
console.log("========================================\n");
