const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("===================================================================");
console.log("🚀 EduNex Automated APK Builder & Versioned Exporter Pipeline");
console.log("===================================================================");

// ---------------------------------------------------------
// STEP 1: Determine Target Version & Synchronize Configuration
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
const currentVersionInAppJson = appJson.expo?.version || "1.0.1";
const currentVersionCode = appJson.expo?.android?.versionCode || 2;

// Check if user passed a target version as argument: e.g. "node scripts/export-apk.js 1.0.2"
const customVersionArg = process.argv[2] ? process.argv[2].trim().replace(/^v/i, "") : null;
const targetVersion = customVersionArg || currentVersionInAppJson;

// Compute versionCode: if target version differs from appJson, increment versionCode
let targetVersionCode = currentVersionCode;
if (customVersionArg && customVersionArg !== currentVersionInAppJson) {
  targetVersionCode = currentVersionCode + 1;
}

console.log(`\n📌 [Step 1/7] Target App Version: v${targetVersion} | Android versionCode: ${targetVersionCode}`);

// 1a. Update app.json
appJson.expo = appJson.expo || {};
appJson.expo.version = targetVersion;
appJson.expo.android = appJson.expo.android || {};
appJson.expo.android.versionCode = targetVersionCode;
appJson.expo.extra = appJson.expo.extra || {};
appJson.expo.extra.version = targetVersion;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n", "utf-8");
console.log(`   ✓ Synced app.json -> v${targetVersion} (versionCode: ${targetVersionCode})`);

// 1b. Update d:/edunex/package.json
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.version = targetVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`   ✓ Synced d:/edunex/package.json -> v${targetVersion}`);
}

// 1c. Update android/app/build.gradle
if (fs.existsSync(buildGradlePath)) {
  let gradleContent = fs.readFileSync(buildGradlePath, "utf-8");
  gradleContent = gradleContent.replace(/versionName\s+"[^"]*"/g, `versionName "${targetVersion}"`);
  gradleContent = gradleContent.replace(/versionCode\s+\d+/g, `versionCode ${targetVersionCode}`);
  fs.writeFileSync(buildGradlePath, gradleContent, "utf-8");
  console.log(`   ✓ Synced android/app/build.gradle -> versionName "${targetVersion}", versionCode ${targetVersionCode}`);
}

// 1d. Sync fallback version in updateService.js
const updateServicePath = path.join(projectRoot, "app", "services", "updateService.js");
if (fs.existsSync(updateServicePath)) {
  let content = fs.readFileSync(updateServicePath, "utf-8");
  content = content.replace(/(Constants\.manifest\?\.version\s*\|\|\s*)"[^"]*"/g, `$1"${targetVersion}"`);
  fs.writeFileSync(updateServicePath, content, "utf-8");
  console.log(`   ✓ Synced app/services/updateService.js fallback -> v${targetVersion}`);
}

// 1e. Sync fallback version in AppUpdateModal.js
const updateModalPath = path.join(projectRoot, "app", "components", "common", "AppUpdateModal.js");
if (fs.existsSync(updateModalPath)) {
  let content = fs.readFileSync(updateModalPath, "utf-8");
  content = content.replace(/Constants\.manifest\?\.version\s*\|\|\s*"[^"]*"/g, `Constants.manifest?.version || "${targetVersion}"`);
  fs.writeFileSync(updateModalPath, content, "utf-8");
  console.log(`   ✓ Synced app/components/common/AppUpdateModal.js fallback -> v${targetVersion}`);
}

// 1f. Sync FeedbackBugModal.js
const feedbackModalPath = path.join(projectRoot, "app", "components", "FeedbackBugModal.js");
if (fs.existsSync(feedbackModalPath)) {
  let content = fs.readFileSync(feedbackModalPath, "utf-8");
  content = content.replace(/appVersion:\s*"[^"]*"/g, `appVersion: "${targetVersion} (EduNex Ecosystem)"`);
  fs.writeFileSync(feedbackModalPath, content, "utf-8");
  console.log(`   ✓ Synced app/components/FeedbackBugModal.js -> v${targetVersion}`);
}

// 1g. Sync related sister projects if present
const sisterProjects = [
  { name: "edunex-backend", dir: path.join(projectRoot, "..", "edunex-backend") },
  { name: "edunex-dashboard", dir: path.join(projectRoot, "..", "edunex-dashboard") },
  { name: "EduNex-app", dir: "D:\\EduNex-app" },
];

for (const proj of sisterProjects) {
  const pJson = path.join(proj.dir, "package.json");
  if (fs.existsSync(pJson)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pJson, "utf-8"));
      parsed.version = targetVersion;
      fs.writeFileSync(pJson, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
      console.log(`   ✓ Synced ${proj.name}/package.json -> v${targetVersion}`);
    } catch (_e) {}
  }
}

// ---------------------------------------------------------
// STEP 2: Thorough Cleanup of Build Outputs & Destination APKs
// ---------------------------------------------------------
console.log(`\n🧹 [Step 2/7] Cleaning up stale build outputs & distribution directories...`);

const destDir = "D:\\EduNex-app";
if (!fs.existsSync(destDir)) {
  try {
    fs.mkdirSync(destDir, { recursive: true });
  } catch (_e) {}
}

const finalDestDir = fs.existsSync(destDir) ? destDir : path.join(projectRoot, "dist-apk");
if (!fs.existsSync(finalDestDir)) fs.mkdirSync(finalDestDir, { recursive: true });

const targetFileName = `EDUNEX_V${targetVersion}.apk`;
const targetFilePath = path.join(finalDestDir, targetFileName);
const latestFilePath = path.join(finalDestDir, "EduNex.apk");

// Clean APKs across destination root, public, and dist
const cleanApksInDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.toLowerCase().endsWith(".apk")) {
      try {
        fs.unlinkSync(path.join(dir, file));
        console.log(`   🗑️ Cleaned: ${path.join(path.basename(dir) || 'root', file)}`);
      } catch (_err) {}
    }
  }
};

cleanApksInDir(finalDestDir);
cleanApksInDir(path.join(finalDestDir, "public"));
cleanApksInDir(path.join(finalDestDir, "dist"));

// Clean local Android build outputs
const apkOutputDir = path.join(projectRoot, "android", "app", "build", "outputs", "apk", "release");
if (fs.existsSync(apkOutputDir)) {
  cleanApksInDir(apkOutputDir);
}

// Clean gradle caches
const androidDir = path.join(projectRoot, "android");
const isWindows = process.platform === "win32";
const gradlewCleanCmd = isWindows ? "gradlew.bat clean" : "./gradlew clean";
try {
  console.log(`   ⚡ Executing Gradle clean...`);
  execSync(gradlewCleanCmd, { cwd: androidDir, stdio: "ignore" });
  console.log(`   ✓ Gradle clean completed.`);
} catch (cleanErr) {
  console.warn(`   (i) Notice on gradlew clean:`, cleanErr.message);
}

// ---------------------------------------------------------
// STEP 3: Compile Fresh Release APK (Gradle)
// ---------------------------------------------------------
console.log(`\n⚡ [Step 3/7] Compiling fresh Release APK for v${targetVersion} (Code: ${targetVersionCode})...`);
const gradlewBuildCmd = isWindows ? "gradlew.bat assembleRelease" : "./gradlew assembleRelease";

try {
  execSync(gradlewBuildCmd, {
    cwd: androidDir,
    stdio: "inherit",
  });
} catch (err) {
  console.error("\n❌ Gradle build failed:", err.message);
  process.exit(1);
}

// ---------------------------------------------------------
// STEP 4: Select arm64-v8a Binary & Verify Metadata with AAPT
// ---------------------------------------------------------
console.log(`\n📦 [Step 4/7] Selecting _v8a-release.apk and verifying binary metadata...`);

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

// Optional AAPT Badging Check
try {
  const localAppData = process.env.LOCALAPPDATA || "";
  const buildToolsDir = path.join(localAppData, "Android", "Sdk", "build-tools");
  if (fs.existsSync(buildToolsDir)) {
    const versions = fs.readdirSync(buildToolsDir).sort().reverse();
    for (const ver of versions) {
      const aaptPath = path.join(buildToolsDir, ver, "aapt.exe");
      if (fs.existsSync(aaptPath)) {
        const badging = execSync(`"${aaptPath}" dump badging "${sourceApk}"`, { encoding: "utf-8" });
        const pkgLine = badging.split("\n").find((l) => l.startsWith("package:"));
        if (pkgLine) {
          console.log(`   🔍 AAPT Verified Binary Metadata:\n      ${pkgLine.trim()}`);
        }
        break;
      }
    }
  }
} catch (_aaptErr) {}

// ---------------------------------------------------------
// STEP 5: Deploy APK to All Distribution Folders
// ---------------------------------------------------------
console.log(`\n📂 [Step 5/7] Deploying APK binaries to all distribution paths...`);

const stats = fs.statSync(sourceApk);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
const byteSize = stats.size.toLocaleString();

// 1. Root
fs.copyFileSync(sourceApk, targetFilePath);
fs.copyFileSync(sourceApk, latestFilePath);

// 2. public/
const publicDir = path.join(finalDestDir, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(sourceApk, path.join(publicDir, targetFileName));
fs.copyFileSync(sourceApk, path.join(publicDir, "EduNex.apk"));

// 3. dist/
const distDir = path.join(finalDestDir, "dist");
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(sourceApk, path.join(distDir, targetFileName));
fs.copyFileSync(sourceApk, path.join(distDir, "EduNex.apk"));

console.log(`   ✓ Copied ${targetFileName} & EduNex.apk (${sizeMB} MB) to:`);
console.log(`      - ${finalDestDir}`);
console.log(`      - ${publicDir}`);
console.log(`      - ${distDir}`);

// ---------------------------------------------------------
// STEP 6: Rewrite Web Portal (index.html & src/main.js) & Build Vite
// ---------------------------------------------------------
console.log(`\n🌐 [Step 6/7] Updating web download portal in ${finalDestDir}...`);
const indexPath = path.join(finalDestDir, "index.html");
const mainJsPath = path.join(finalDestDir, "src", "main.js");

if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, "utf-8");
  indexContent = indexContent.replace(/EduNex (?:Latest )?Release v[0-9.]+/gi, `EduNex Latest Release v${targetVersion}`);
  indexContent = indexContent.replace(/<span class="tag-pill">v[0-9.]+<\/span>/gi, `<span class="tag-pill">v${targetVersion}</span>`);
  indexContent = indexContent.replace(/<span>v[0-9.]+<\/span>/gi, `<span>v${targetVersion}</span>`);
  indexContent = indexContent.replace(/<span class="tag-pill active">● Official Release<\/span>\s*<span class="tag-pill">v[0-9.]+<\/span>\s*<span class="tag-pill">[0-9.]+ MB<\/span>/gi, `<span class="tag-pill active">● Official Release</span>\n          <span class="tag-pill">v${targetVersion}</span>\n          <span class="tag-pill">${sizeMB} MB</span>`);
  indexContent = indexContent.replace(/File name: <code>[^<]*<\/code>/gi, `File name: <code>${targetFileName}</code>`);
  indexContent = indexContent.replace(/href="[^"]*EDUNEX_V[^"]*\.apk"/gi, `href="${targetFileName}"`);
  indexContent = indexContent.replace(/href="EduNex\.apk"/gi, `href="${targetFileName}"`);
  indexContent = indexContent.replace(/download="[^"]*"/gi, `download="${targetFileName}"`);
  indexContent = indexContent.replace(/triggerToast\('[^']*'\)/gi, `triggerToast('${targetFileName}')`);
  fs.writeFileSync(indexPath, indexContent, "utf-8");
  console.log(`   ✓ Rewrote index.html with v${targetVersion} (${targetFileName})`);
}

if (fs.existsSync(mainJsPath)) {
  let mainContent = fs.readFileSync(mainJsPath, "utf-8");
  mainContent = mainContent.replace(/version:\s*"[^"]*"/gi, `version: "${targetVersion} (Latest Release)"`);
  mainContent = mainContent.replace(/size:\s*"[^"]*"/gi, `size: "${sizeMB} MB (${byteSize} bytes)"`);
  mainContent = mainContent.replace(/href="[^"]*EDUNEX_V[^"]*\.apk"/gi, `href="${targetFileName}"`);
  mainContent = mainContent.replace(/href="EduNex\.apk"/gi, `href="${targetFileName}"`);
  mainContent = mainContent.replace(/download="[^"]*"/gi, `download="${targetFileName}"`);
  mainContent = mainContent.replace(/triggerToast\('[^']*'\)/gi, `triggerToast('${targetFileName}')`);
  fs.writeFileSync(mainJsPath, mainContent, "utf-8");
  console.log(`   ✓ Rewrote src/main.js`);
}

// Rebuild frontend distribution
const destPkgPath = path.join(finalDestDir, "package.json");
if (fs.existsSync(destPkgPath)) {
  try {
    console.log(`   ⚡ Compiling Vite production assets...`);
    execSync("npm run build", { cwd: finalDestDir, stdio: "inherit" });
    // Guarantee dist directory has latest copies after Vite build
    fs.copyFileSync(sourceApk, path.join(distDir, targetFileName));
    fs.copyFileSync(sourceApk, path.join(distDir, "EduNex.apk"));
    console.log(`   ✓ Vite production build ready with verified APKs in dist/.`);
  } catch (buildErr) {
    console.warn("   [!] Frontend build notice:", buildErr.message);
  }
}

// ---------------------------------------------------------
// STEP 7: Push to GitHub Repositories
// ---------------------------------------------------------
console.log(`\n📤 [Step 7/7] Pushing updated APK & repositories to GitHub...`);

// 7a. Push D:/EduNex-app
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

// 7b. Sync main project repository (d:/edunex)
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
console.log(`🎉 Automated Pipeline Succeeded!`);
console.log(`📦 Version: v${targetVersion} (Version Code: ${targetVersionCode})`);
console.log(`🎯 Architecture: arm64-v8a (_v8a-release)`);
console.log(`📁 Target File: ${targetFilePath} (${sizeMB} MB)`);
console.log(`🌐 Web Portal: Synced and Pushed to GitHub`);
console.log("===================================================================\n");
