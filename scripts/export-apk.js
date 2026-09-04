const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("===================================================================");
console.log("🚀 EduNex Automated APK Builder, Version Exporter & Git Synchronizer");
console.log("===================================================================");

// 1. Read app version directly from app.json
const projectRoot = path.join(__dirname, "..");
const appJsonPath = path.join(projectRoot, "app.json");
const pkgPath = path.join(projectRoot, "package.json");

let version = "1.0.1";
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  version = appJson.expo?.version || version;
} else if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  version = pkg.version || version;
}

console.log(`\n📦 Current Expo App Version (app.json): v${version}`);

// 2. Setup destination D:/EduNex-app
const destDir = "D:\\EduNex-app";
if (!fs.existsSync(destDir)) {
  try {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`[+] Created destination directory: ${destDir}`);
  } catch (err) {
    console.warn(`[!] Destination ${destDir} notice:`, err.message);
  }
}

const finalDestDir = fs.existsSync(destDir) ? destDir : path.join(projectRoot, "dist-apk");
if (!fs.existsSync(finalDestDir)) fs.mkdirSync(finalDestDir, { recursive: true });

// Formatted target name: EDUNEX_V[version].apk
const targetFileName = `EDUNEX_V${version}.apk`;
const targetFilePath = path.join(finalDestDir, targetFileName);
const latestFilePath = path.join(finalDestDir, "EduNex.apk");

// 3. Pre-check if target APK already exists in D:/EduNex-app
console.log("\n🔍 Checking destination for existing versioned APK...");
if (fs.existsSync(targetFilePath)) {
  const existingStats = fs.statSync(targetFilePath);
  const oldSizeMB = (existingStats.size / (1024 * 1024)).toFixed(2);
  const modifiedTime = existingStats.mtime.toLocaleString();
  console.log(`⚠️ Existing file found: ${targetFileName}`);
  console.log(`   Size: ${oldSizeMB} MB | Last modified: ${modifiedTime}`);
  console.log(`♻️ It will be rewritten with the fresh build.`);
} else {
  console.log(`✨ Target file ${targetFileName} does not exist yet (Will create fresh).`);
}

// 4. Build Release APK via Gradle
console.log("\n⚡ Converting entire project into Release APK (Gradle)...");
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

// 5. Select the modern _v8a-release.apk (arm64-v8a)
const apkDir = path.join(androidDir, "app", "build", "outputs", "apk", "release");
const v8aCandidates = [
  path.join(apkDir, "app-arm64-v8a-release.apk"),
  path.join(apkDir, "app-arm64-v8a-release-unsigned.apk"),
];
const fallbackCandidates = [
  path.join(apkDir, "app-universal-release.apk"),
  path.join(apkDir, "app-release.apk"),
];

let sourceApk = v8aCandidates.find((f) => fs.existsSync(f));
let isV8aSelected = Boolean(sourceApk);

if (!sourceApk) {
  sourceApk = fallbackCandidates.find((f) => fs.existsSync(f));
}

if (!sourceApk && fs.existsSync(apkDir)) {
  const files = fs.readdirSync(apkDir).filter((f) => f.endsWith(".apk"));
  const v8aFile = files.find((f) => f.includes("v8a") && f.includes("release"));
  if (v8aFile) {
    sourceApk = path.join(apkDir, v8aFile);
    isV8aSelected = true;
  } else if (files.length > 0) {
    sourceApk = path.join(apkDir, files[0]);
  }
}

if (!sourceApk || !fs.existsSync(sourceApk)) {
  console.error("\n❌ No built APK found in output directory:", apkDir);
  process.exit(1);
}

console.log(`\n🎯 Selected Source APK: ${path.basename(sourceApk)} ${isV8aSelected ? "(_v8a-release 64-bit architecture)" : ""}`);

// 6. Rewrite and move to D:/EduNex-app/EDUNEX_V[version].apk
console.log(`\n📁 Renaming and saving to:\n👉 ${targetFilePath}`);

if (fs.existsSync(targetFilePath)) {
  try {
    fs.unlinkSync(targetFilePath);
  } catch (_e) {}
}

fs.copyFileSync(sourceApk, targetFilePath);
fs.copyFileSync(sourceApk, latestFilePath);

const stats = fs.statSync(targetFilePath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
const byteSize = stats.size.toLocaleString();

console.log("\n===================================================================");
console.log(`✅ SUCCESS: Exported ${targetFileName} (${sizeMB} MB)`);
console.log(`📍 Output Path: ${targetFilePath}`);
console.log("===================================================================");

// 7. Rewrite the index.html page and src/main.js in D:/EduNex-app
const indexPath = path.join(finalDestDir, "index.html");
const mainJsPath = path.join(finalDestDir, "src", "main.js");

if (fs.existsSync(indexPath)) {
  console.log(`\n🔄 Rewriting ${indexPath} for version v${version}...`);
  let indexContent = fs.readFileSync(indexPath, "utf-8");
  indexContent = indexContent.replace(/EduNex (?:Latest )?Release v[0-9.]+/gi, `EduNex Latest Release v${version}`);
  indexContent = indexContent.replace(/<span class="tag-pill">v[0-9.]+<\/span>/gi, `<span class="tag-pill">v${version}</span>`);
  indexContent = indexContent.replace(/<span>v[0-9.]+<\/span>/gi, `<span>v${version}</span>`);
  indexContent = indexContent.replace(/File name: <code>[^<]*<\/code>/gi, `File name: <code>${targetFileName}</code>`);
  indexContent = indexContent.replace(/download="[^"]*"/gi, `download="${targetFileName}"`);
  indexContent = indexContent.replace(/triggerToast\('[^']*'\)/gi, `triggerToast('${targetFileName}')`);
  fs.writeFileSync(indexPath, indexContent, "utf-8");
  console.log(`[OK] index.html rewritten with version v${version} & download file ${targetFileName}`);
}

if (fs.existsSync(mainJsPath)) {
  console.log(`🔄 Rewriting ${mainJsPath} for version v${version}...`);
  let mainContent = fs.readFileSync(mainJsPath, "utf-8");
  mainContent = mainContent.replace(/version:\s*"[^"]*"/gi, `version: "${version} (Latest Release)"`);
  mainContent = mainContent.replace(/size:\s*"[^"]*"/gi, `size: "${sizeMB} MB (${byteSize} bytes)"`);
  mainContent = mainContent.replace(/download="[^"]*"/gi, `download="${targetFileName}"`);
  mainContent = mainContent.replace(/triggerToast\('[^']*'\)/gi, `triggerToast('${targetFileName}')`);
  fs.writeFileSync(mainJsPath, mainContent, "utf-8");
  console.log(`[OK] src/main.js updated`);
}

// Rebuild frontend web distribution
const destPkgPath = path.join(finalDestDir, "package.json");
if (fs.existsSync(destPkgPath)) {
  try {
    console.log(`\n⚡ Rebuilding frontend distribution in ${finalDestDir}...`);
    execSync("npm run build", { cwd: finalDestDir, stdio: "inherit" });
  } catch (buildErr) {
    console.warn("Frontend build notice:", buildErr.message);
  }
}

// 8. Commit and Push to GitHub repository for D:/EduNex-app
const appGitDir = path.join(finalDestDir, ".git");
if (fs.existsSync(appGitDir)) {
  console.log(`\n===================================================================`);
  console.log(`📤 Pushing Updated APK & Web Portal to GitHub (${finalDestDir})...`);
  console.log(`===================================================================`);
  const commitMsg = `Release: v${version} - Update ${targetFileName} (_v8a-release) & download portal`;
  try {
    execSync(`git add .`, { cwd: finalDestDir, stdio: "inherit" });
    try {
      execSync(`git commit -m "${commitMsg}"`, { cwd: finalDestDir, stdio: "inherit" });
    } catch (_commitErr) {
      console.log("ℹ️ No uncommitted changes in portal repository.");
    }
    execSync(`git push origin main`, { cwd: finalDestDir, stdio: "inherit" });
    console.log(`\n[OK] Successfully pushed ${targetFileName} and updated portal to GitHub!`);
  } catch (gitErr) {
    console.warn(`[!] Git push notice:`, gitErr.message);
  }
}

// 9. Synchronize original Mobile Project Repository (d:/edunex)
const projectGitDir = path.join(projectRoot, ".git");
if (fs.existsSync(projectGitDir)) {
  console.log(`\n===================================================================`);
  console.log(`📤 Synchronizing Project Repository (${projectRoot})...`);
  console.log(`===================================================================`);
  const projectCommitMsg = `Release: App v${version} - Export ${targetFileName} & sync distribution`;
  try {
    execSync(`git add .`, { cwd: projectRoot, stdio: "inherit" });
    try {
      execSync(`git commit -m "${projectCommitMsg}"`, { cwd: projectRoot, stdio: "inherit" });
    } catch (_pCommitErr) {}
    try {
      execSync(`git push origin master`, { cwd: projectRoot, stdio: "inherit" });
      console.log(`[OK] Successfully pushed changes to main project repository!`);
    } catch {
      try {
        execSync(`git push origin main`, { cwd: projectRoot, stdio: "inherit" });
        console.log(`[OK] Successfully pushed changes to main project repository!`);
      } catch (_pushErr) {}
    }
  } catch (projGitErr) {
    console.warn(`[!] Project git notice:`, projGitErr.message);
  }
}

console.log("\n===================================================================");
console.log(`🎉 Pipeline Complete! Version: v${version} | Target APK: ${targetFileName}`);
console.log(`📍 File Location: ${targetFilePath}`);
console.log("===================================================================\n");
