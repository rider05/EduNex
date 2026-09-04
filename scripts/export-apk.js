const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("===================================================");
console.log("🚀 EduNex Release APK Builder & Git Auto-Pusher");
console.log("===================================================");

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
const latestFilePath = path.join(finalDestDir, "EduNex.apk");

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
  } catch (_e) {}
}

fs.copyFileSync(sourceApk, targetFilePath);
fs.copyFileSync(sourceApk, latestFilePath);

const stats = fs.statSync(targetFilePath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n===================================================");
console.log(`✅ SUCCESS! Exported APK: ${targetFileName} (${sizeMB} MB)`);
console.log(`📍 Location: ${targetFilePath}`);
console.log("===================================================");

// 6. Push to Git in D:/EduNex-app
const gitDir = path.join(finalDestDir, ".git");
if (fs.existsSync(gitDir)) {
  console.log(`\n===================================================`);
  console.log(`📤 Pushing Updated APK to GitHub (${finalDestDir})...`);
  console.log(`===================================================`);
  try {
    execSync(`git add "${targetFileName}" "EduNex.apk"`, { cwd: finalDestDir, stdio: "inherit" });
    try {
      execSync(`git commit -m "Release: Build & deploy EduNex V${version}.apk"`, { cwd: finalDestDir, stdio: "inherit" });
    } catch (_commitErr) {
      console.log("ℹ️ No new changes to commit in git repository.");
    }
    execSync(`git push origin main`, { cwd: finalDestDir, stdio: "inherit" });
    console.log(`\n[OK] Successfully pushed ${targetFileName} to GitHub repository!`);
  } catch (gitErr) {
    console.warn(`[!] Git push error:`, gitErr.message);
  }
}

console.log("\n===================================================");
console.log("🎉 All Tasks Completed Successfully!");
console.log("===================================================\n");
