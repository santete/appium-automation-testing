/**
 * M4 Task 14 — Build state-test debuggable APK qua Gradle wrapper.
 *
 * Plan ref: docs/plans/M4-cicd.md Task 13-14, Decision 11.
 *
 * Vì Gradle CLI không cài trên dev machine (chỉ JDK + Android SDK), script này:
 *   1. Bootstrap Gradle wrapper (download jar + scripts từ gradle/gradle@v8.5.0)
 *      lần đầu chạy. Idempotent — skip nếu wrapper đã tồn tại.
 *   2. Run `gradlew assembleDebug` để build APK.
 *   3. Copy APK output về path stable `apps/state-test-debug.apk` cho integration
 *      spec reference.
 *
 * Usage:
 *   node scripts/build-test-apk.cjs
 *
 * Prereq:
 *   - JAVA_HOME set User scope (JDK 17).
 *   - ANDROID_HOME = C:\Android (M1 verified).
 *   - Network access tới github.com + services.gradle.org (bootstrap + dist).
 *
 * Failure modes:
 *   - Wrapper bootstrap fail → exit 1, manual fix bằng `gradle wrapper` nếu có
 *     Gradle CLI, hoặc retry network.
 *   - assembleDebug fail → exit Gradle's exit code, log full stderr.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.resolve(REPO_ROOT, 'apps', 'test-debuggable-src');
const WRAPPER_DIR = path.resolve(APP_DIR, 'gradle', 'wrapper');
const APK_OUTPUT = path.resolve(
  APP_DIR,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
);
const APK_STABLE = path.resolve(REPO_ROOT, 'apps', 'state-test-debug.apk');

// Pin Gradle 8.5.0 — match `gradle-wrapper.properties` distributionUrl.
const WRAPPER_JAR_URL =
  'https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar';
const GRADLEW_URL = 'https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradlew';
const GRADLEW_BAT_URL = 'https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradlew.bat';

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(destPath);
        download(res.headers.location, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function bootstrapWrapper() {
  const wrapperJar = path.resolve(WRAPPER_DIR, 'gradle-wrapper.jar');
  const gradlew = path.resolve(APP_DIR, 'gradlew');
  const gradlewBat = path.resolve(APP_DIR, 'gradlew.bat');

  fs.mkdirSync(WRAPPER_DIR, { recursive: true });

  if (!fs.existsSync(wrapperJar)) {
    console.log(`[bootstrap] Download gradle-wrapper.jar → ${wrapperJar}`);
    await download(WRAPPER_JAR_URL, wrapperJar);
  } else {
    console.log('[bootstrap] gradle-wrapper.jar exists, skip.');
  }

  if (!fs.existsSync(gradlew)) {
    console.log(`[bootstrap] Download gradlew → ${gradlew}`);
    await download(GRADLEW_URL, gradlew);
    fs.chmodSync(gradlew, 0o755);
  } else {
    console.log('[bootstrap] gradlew exists, skip.');
  }

  if (!fs.existsSync(gradlewBat)) {
    console.log(`[bootstrap] Download gradlew.bat → ${gradlewBat}`);
    await download(GRADLEW_BAT_URL, gradlewBat);
  } else {
    console.log('[bootstrap] gradlew.bat exists, skip.');
  }
}

function runGradleAssembleDebug() {
  const isWin = process.platform === 'win32';
  const wrapper = isWin ? 'gradlew.bat' : './gradlew';

  console.log(`[build] Run ${wrapper} assembleDebug (cwd=${APP_DIR})`);
  const result = spawnSync(wrapper, ['assembleDebug', '--no-daemon'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    shell: isWin,
  });

  if (result.error) {
    console.error(`[FAIL] Gradle wrapper exec error: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[FAIL] Gradle assembleDebug exit ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function copyApk() {
  if (!fs.existsSync(APK_OUTPUT)) {
    console.error(`[FAIL] APK not found at expected path: ${APK_OUTPUT}`);
    process.exit(1);
  }
  fs.copyFileSync(APK_OUTPUT, APK_STABLE);
  const sizeKb = Math.round(fs.statSync(APK_STABLE).size / 1024);
  console.log(`[OK] APK built → ${APK_STABLE} (${sizeKb} KB)`);
}

(async () => {
  try {
    await bootstrapWrapper();
    runGradleAssembleDebug();
    copyApk();
  } catch (err) {
    console.error(`[FAIL] ${err.message}`);
    process.exit(1);
  }
})();
