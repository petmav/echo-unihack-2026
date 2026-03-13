#!/usr/bin/env node
/**
 * Patches android/gradle.properties and android/local.properties so the Gradle
 * build works without needing JAVA_HOME or ANDROID_HOME set globally.
 *
 * Fixes:
 *   "Unsupported class file major version" — system Java too new for Gradle
 *   "SDK location not found"               — ANDROID_HOME not set
 *   "./gradlew not recognized"             — pass --build to run gradle via Node
 *
 * Run after `npx cap add android`:
 *   node scripts/setup-android.js           # patch only
 *   node scripts/setup-android.js --build   # patch + run assembleDebug
 *
 * Safe to re-run — idempotent.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ANDROID_DIR    = path.join(__dirname, '..', 'android');
const GRADLE_PROPS   = path.join(ANDROID_DIR, 'gradle.properties');
const LOCAL_PROPS    = path.join(ANDROID_DIR, 'local.properties');

// ── JDK detection ────────────────────────────────────────────────────────────

function findAndroidStudioJdk() {
  const candidates = [];

  if (process.platform === 'win32') {
    const pf  = process.env.ProgramFiles  || 'C:\\Program Files';
    const lad = process.env.LOCALAPPDATA  || '';
    candidates.push(
      path.join(pf,  'Android', 'Android Studio', 'jbr'),
      path.join(lad, 'Programs', 'Android', 'Android Studio', 'jbr'),
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
      '/Applications/Android Studio.app/Contents/jre/Contents/Home',
    );
  } else {
    candidates.push(
      path.join(os.homedir(), 'android-studio', 'jbr'),
      '/opt/android-studio/jbr',
    );
  }

  return candidates.find(p => fs.existsSync(p)) || null;
}

// ── SDK detection ─────────────────────────────────────────────────────────────

function findAndroidSdk() {
  // 1. Already set in environment
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  // 2. Common install locations
  const candidates = [];

  if (process.platform === 'win32') {
    const lad = process.env.LOCALAPPDATA || '';
    candidates.push(path.join(lad, 'Android', 'Sdk'));
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Android', 'sdk'));
  } else {
    candidates.push(path.join(os.homedir(), 'Android', 'Sdk'));
  }

  return candidates.find(p => fs.existsSync(p)) || null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(ANDROID_DIR)) {
  console.error('[setup-android] android/ directory not found — run `npx cap add android` first.');
  process.exit(1);
}

// --- gradle.properties: pin JDK ---

const jdkPath = findAndroidStudioJdk();

let gradleContent = fs.existsSync(GRADLE_PROPS) ? fs.readFileSync(GRADLE_PROPS, 'utf8') : '';

if (!gradleContent.includes('org.gradle.java.home')) {
  if (jdkPath) {
    const gradleJdkPath = jdkPath.replace(/\\/g, '/');
    gradleContent +=
      '\n# Pinned to Android Studio bundled JDK (Java 17) — avoids "Unsupported class file' +
      '\n# major version" errors when system Java is newer than Gradle supports.' +
      '\norg.gradle.java.home=' + gradleJdkPath + '\n';
    fs.writeFileSync(GRADLE_PROPS, gradleContent, 'utf8');
    console.log('[setup-android] gradle.properties: org.gradle.java.home=' + gradleJdkPath);
  } else {
    console.warn(
      '[setup-android] Could not find Android Studio JDK. If the build fails with\n' +
      '"Unsupported class file major version", set JAVA_HOME to Java 17 or 21.'
    );
  }
} else {
  console.log('[setup-android] gradle.properties: org.gradle.java.home already set — skipping.');
}

// --- local.properties: set sdk.dir ---

const sdkPath = findAndroidSdk();

let localContent = fs.existsSync(LOCAL_PROPS) ? fs.readFileSync(LOCAL_PROPS, 'utf8') : '';

if (!localContent.includes('sdk.dir')) {
  if (sdkPath) {
    const gradleSdkPath = sdkPath.replace(/\\/g, '/');
    localContent += 'sdk.dir=' + gradleSdkPath + '\n';
    fs.writeFileSync(LOCAL_PROPS, localContent, 'utf8');
    console.log('[setup-android] local.properties: sdk.dir=' + gradleSdkPath);
  } else {
    console.warn(
      '[setup-android] Could not find Android SDK. If the build fails with\n' +
      '"SDK location not found", set ANDROID_HOME to your SDK directory.'
    );
  }
} else {
  console.log('[setup-android] local.properties: sdk.dir already set — skipping.');
}

console.log('[setup-android] Done.');

// ── Optional: run assembleDebug ───────────────────────────────────────────────

if (process.argv.includes('--build')) {
  // The gradlew wrapper reads JAVA_HOME from the environment to bootstrap itself
  // before it can process gradle.properties. If the system JAVA_HOME is wrong
  // (e.g. points to .../jbr/bin/ instead of .../jbr), the wrapper fails.
  // We resolve the correct path here and inject it into the child env.

  const jdkForEnv = jdkPath || (() => {
    // Fall back: strip trailing /bin or \bin from system JAVA_HOME if set
    const h = process.env.JAVA_HOME || '';
    return h.replace(/[/\\]bin[/\\]?$/, '') || null;
  })();

  if (!jdkForEnv) {
    console.error('[setup-android] Cannot determine JDK path for JAVA_HOME. Install Android Studio or set JAVA_HOME.');
    process.exit(1);
  }

  // Use the absolute path to the gradle wrapper so it's found regardless of shell/cwd quirks
  const gradlew = process.platform === 'win32'
    ? path.join(ANDROID_DIR, 'gradlew.bat')
    : path.join(ANDROID_DIR, 'gradlew');

  console.log(`[setup-android] Running: gradlew assembleDebug (JAVA_HOME=${jdkForEnv})`);

  // On Windows, invoke gradlew.bat via cmd.exe so we don't need shell:true
  // (which causes a Node.js security deprecation when passing args).
  const [cmd, args] = process.platform === 'win32'
    ? ['cmd.exe', ['/c', gradlew, 'assembleDebug', '--no-daemon']]
    : [gradlew, ['assembleDebug', '--no-daemon']];

  const result = spawnSync(cmd, args, {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    env: { ...process.env, JAVA_HOME: jdkForEnv },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
