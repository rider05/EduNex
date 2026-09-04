const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("===================================================================");
console.log("🚀 EduNex Automated APK Builder & Versioned Exporter Pipeline");
console.log("===================================================================");

// ---------------------------------------------------------
// STEP 1: Read & Synchronize Version across all config files
// ---------------------------------------------------------
const projectRoot = path.join(__dirname, "..");
const appJsonPath = path.join(projectRoot, "app.json");
const pkgPath = path.join(projectRoot, "package.json");
const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");

if (!fs.existsSync(appJsonPath)) {
  console.error("❌ Fatal: app.json not found in project root!");
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
const targetVersion = appJson.expo?.version || "1.0.1";
const versionCode = appJson.expo?.android?.versionCode || 2;

console.log(`\n📌 [Step 1/6] Validating App Version: v${targetVersion} (Version Code: ${versionCode})`);

// Ensure package.json matches app.json version
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (pkg.version !== targetVersion) {
    pkg.version = targetVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    console.log(`   ✓ Synced package.json version -> ${targetVersion}`);
  }
}

// Ensure android/app/build.gradle matches version
if (fs.existsSync(buildGradlePath)) {
  let gradleContent = fs.readFileSync(buildGradlePath, "utf-8");
  const orig = gradleContent;
  gradleContent = gradleContent.replace(/versionName\s+"[^"]*"/, `versionName "${targetVersion}"`);
  gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  if (orig !== gradleContent) {
    fs.writeFileSync(buildGradlePath, gradleContent, "utf-8");
    console.log(`   ✓ Synced build.gradle -> versionName "${targetVersion}", versionCode ${versionCode}`);
  }
}

// ---------------------------------------------------------
// STEP 2: Clean up previous build files & destination APKs
// ---------------------------------------------------------
console.log(`\n🧹 [Step 2/6] Cleaning up previous artifacts & stale build files...`);

// Destination folder D:/EduNex-app
const destDir = "D:\\EduNex-app";
if (!fs.existsSync(destDir)) {
  try {
    fs.mkdirSync(destDir, { recursive: true });
  } catch (_e) {}
}

const finalDestDir = fs.existsSync(destDir) ? destDir : path.join(projectRoot, "dist-apk");
if (!fs.existsSync(finalDestDir)) fs.mkdirSync(finalDestDir, { recursive: true });

// Remove old versioned APK files from destination folder
const targetFileName = `EDUNEX_V${targetVersion}.apk`;
const targetFilePath = path.join(finalDestDir, targetFileName);
const latestFilePath = path.join(finalDestDir, "EduNex.apk");

const destFiles = fs.readdirSync(finalDestDir);
for (const file of destFiles) {
  if (
    (file.startsWith("EDUNEX_V") || file.startsWith("EduNex V") || file === "EduNex.apk") &&
    file.endsWith(".apk")
  ) {
    const oldPath = path.join(finalDestDir, file);
    try {
      fs.unlinkSync(oldPath);
      console.log(`   🗑️ Removed old artifact: ${file}`);
    } catch (_err) {
      console.log(`   (i) Could not remove ${file}, will overwrite.`);
    }
  }
}

// Clean local Android build outputs
const apkOutputDir = path.join(projectRoot, "android", "app", "build", "outputs", "apk", "release");
if (fs.existsSync(apkOutputDir)) {
  const localApks = fs.readdirSync(apkOutputDir).filter((f) => f.endsWith(".apk"));
  for (const apk of localApks) {
    try {
      fs.unlinkSync(path.join(apkOutputDir, apk));
    } catch (_e) {}
  }
}

// ---------------------------------------------------------
// STEP 3: Compile Fresh Release APK (Gradle)
// ---------------------------------------------------------
console.log(`\n⚡ [Step 3/6] Compiling fresh Release APK for v${targetVersion}...`);
const androidDir = path.join(projectRoot, "android");
const isWindows = process.platform === "win32";
const gradlewCmd = isWindows ? "gradlew.bat assembleRelease" : "./gradlew assembleRelease";

try {
  execSync(gradlewCmd, {
    cwd: androidDir,
    stdio: "inherit",
  });
} catch (err) {
  console.error("\n❌ Gradle build failed:", err.message);
  process.exit(1);
}

// ---------------------------------------------------------
// STEP 4: Select _v8a-release.apk (arm64-v8a) & Move to D:/EduNex-app
// ---------------------------------------------------------
console.log(`\n📦 [Step 4/6] Selecting _v8a-release.apk and moving to ${finalDestDir}...`);

const v8aCandidates = [
  path.join(apkOutputDir, "app-arm64-v8a-release.apk"),
  path.join(apkOutputDir, "app-arm64-v8a-release-unsigned.apk"),
];
const fallbackCandidates = [
  path.join(apkOutputDir, "app-universal-release.apk"),
  path.join(apkOutputDir, "app-release.apk"),
];

let sourceApk = v8aCandidates.find((f) => fs.existsSync(f));
let isV8aSelected = Boolean(sourceApk);

if (!sourceApk) {
  sourceApk = fallbackCandidates.find((f) => fs.existsSync(f));
}

if (!sourceApk && fs.existsSync(apkOutputDir)) {
  const files = fs.readdirSync(apkOutputDir).filter((f) => f.endsWith(".apk"));
  const v8aFile = files.find((f) => f.includes("v8a") && f.includes("release"));
  if (v8aFile) {
    sourceApk = path.join(apkOutputDir, v8aFile);
    isV8aSelected = true;
  } else if (files.length > 0) {
    sourceApk = path.join(apkOutputDir, files[0]);
  }
}

if (!sourceApk || !fs.existsSync(sourceApk)) {
  console.error("\n❌ Error: No generated APK found in:", apkOutputDir);
  process.exit(1);
}

console.log(`   🎯 Selected Binary: ${path.basename(sourceApk)} ${isV8aSelected ? "(_v8a-release 64-bit)" : ""}`);

// Copy fresh APK to EDUNEX_V[version].apk and EduNex.apk
fs.copyFileSync(sourceApk, targetFilePath);
fs.copyFileSync(sourceApk, latestFilePath);

const stats = fs.statSync(targetFilePath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
const byteSize = stats.size.toLocaleString();

console.log(`   ✅ Renamed and saved:`);
console.log(`      👉 ${targetFilePath} (${sizeMB} MB)`);
console.log(`      👉 ${latestFilePath}`);

// ---------------------------------------------------------
// STEP 5: Rewrite D:/EduNex-app index.html & rebuild web portal
// ---------------------------------------------------------
console.log(`\n🌐 [Step 5/6] Updating web download portal in ${finalDestDir}...`);
const indexPath = path.join(finalDestDir, "index.html");
const mainJsPath = path.join(finalDestDir, "src", "main.js");

if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, "utf-8");
  indexContent = indexContent.replace(/EduNex (?:Latest )?Release v[0-9.]+/gi, `EduNex Latest Release v${targetVersion}`);
  indexContent = indexContent.replace(/<span class="tag-pill">v[0-9.]+<\/span>/gi, `<span class="tag-pill">v${targetVersion}</span>`);
  indexContent = indexContent.replace(/<span>v[0-9.]+<\/span>/gi, `<span>v${targetVersion}</span>`);
  indexContent = indexContent.replace(/File name: <code>[^<]*<\/code>/gi, `File name: <code>${targetFileName}</code>`);
  indexContent = indexContent.replace(/download="[^"]*"/gi, `download="${targetFileName}"`);
  indexContent = indexContent.replace(/triggerToast\('[^']*'\)/gi, `triggerToast('${targetFileName}')`);
  fs.writeFileSync(indexPath, indexContent, "utf-8");
  console.log(`   ✓ Rewrote index.html with v${targetVersion} and ${targetFileName}`);
}

if (fs.existsSync(mainJsPath)) {
  let mainContent = fs.readFileSync(mainJsPath, "utf-8");
  mainContent = mainContent.replace(/version:\s*"[^"]*"/gi, `version: "${targetVersion} (Latest Release)"`);
  mainContent = mainContent.replace(/size:\s*"[^"]*"/gi, `size: "${sizeMB} MB (${byteSize} bytes)"`);
  mainContent = mainContent.replace(/download="[^"]*"/gi, `download="${targetFileName}"`);
  mainContent = mainContent.replace(/triggerToast\('[^']*'\)/gi, `triggerToast('${targetFileName}')`);
  fs.writeFileSync(mainJsPath, mainContent, "utf-8");
  console.log(`   ✓ Rewrote src/main.js`);
}

// Rebuild frontend distribution
const destPkgPath = path.join(finalDestDir, "package.json");
if (fs.existsSync(destPkgPath)) {
  try {
    console.log(`   ⚡ Rebuilding web portal distribution bundle...`);
    execSync("npm run build", { cwd: finalDestDir, stdio: "inherit" });
  } catch (buildErr) {
    console.warn("   [!] Frontend build notice:", buildErr.message);
  }
}

// ---------------------------------------------------------
// STEP 6: Push to GitHub Repositories
// ---------------------------------------------------------
console.log(`\n📤 [Step 6/6] Pushing updated APK & portal to GitHub...`);

// 6a. Push D:/EduNex-app
const appGitDir = path.join(finalDestDir, ".git");
if (fs.existsSync(appGitDir)) {
  const commitMsg = `Release: v${targetVersion} - Build ${targetFileName} (_v8a-release) & update download portal`;
  try {
    execSync(`git add .`, { cwd: finalDestDir, stdio: "inherit" });
    try {
      execSync(`git commit -m "${commitMsg}"`, { cwd: finalDestDir, stdio: "inherit" });
    } catch (_commitErr) {}
    execSync(`git push origin main`, { cwd: finalDestDir, stdio: "inherit" });
    console.log(`   [OK] Successfully pushed ${targetFileName} to EduNex-app GitHub repository!`);
  } catch (gitErr) {
    console.warn(`   [!] EduNex-app git push notice:`, gitErr.message);
  }
}

// 6b. Sync main project repository (d:/edunex)
const projectGitDir = path.join(projectRoot, ".git");
if (fs.existsSync(projectGitDir)) {
  const projectCommitMsg = `Release: App v${targetVersion} - Automated export ${targetFileName} & portal sync`;
  try {
    execSync(`git add .`, { cwd: projectRoot, stdio: "inherit" });
    try {
      execSync(`git commit -m "${projectCommitMsg}"`, { cwd: projectRoot, stdio: "inherit" });
    } catch (_pCommitErr) {}
    try {
      execSync(`git push origin master`, { cwd: projectRoot, stdio: "inherit" });
      console.log(`   [OK] Successfully pushed changes to main project repository!`);
    } catch {
      try {
        execSync(`git push origin main`, { cwd: projectRoot, stdio: "inherit" });
        console.log(`   [OK] Successfully pushed changes to main project repository!`);
      } catch (_pushErr) {}
    }
  } catch (projGitErr) {
    console.warn(`   [!] Project git notice:`, projGitErr.message);
  }
}

console.log("\n===================================================================");
console.log(`🎉 Pipeline Complete! Version: v${targetVersion} | Binary: ${targetFileName}`);
console.log(`📍 Saved Location: ${targetFilePath}`);
console.log("===================================================================\n");
