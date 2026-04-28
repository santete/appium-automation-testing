# State Test APK (M4 Task 13)

Minimal debuggable Android app dùng cho M4 D4 real-device verification của
`StateChecker.mobile:executeScript` backend.

Plan ref: `docs/plans/M4-cicd.md` Task 13-15, Decision 11.

## Behavior

`MainActivity.onCreate` writes `m4_state_test_key=ok` vào 2 SharedPreferences file:
1. Default prefs `<package>_preferences.xml`.
2. Custom prefs `state_test_prefs.xml`.

Integration spec `tests/integration/state-checker-mobile-real.spec.ts` install APK,
launch activity, lookup qua `mobile:executeScript` adapter → assert match.

## Build

Gradle CLI không cài trên dev machine — dùng wrapper. Wrapper JAR + scripts
được bootstrap bởi:

```bash
node scripts/build-test-apk.cjs
```

Output: `apps/test-debuggable-src/app/build/outputs/apk/debug/app-debug.apk`.

## Manual build (sau bootstrap)

```bash
cd apps/test-debuggable-src
./gradlew assembleDebug
```

## Package details

- `applicationId`: `com.santete.statetest`
- `minSdk`: 24 (Android 7.0)
- `targetSdk`: 34 (Android 14)
- `compileSdk`: 34
- AGP: 8.2.2 / Kotlin: 1.9.22 / Gradle: 8.5

## Prereq

- JDK 17 (Adoptium) — `JAVA_HOME` set User scope (đã verify M1).
- Android SDK — `ANDROID_HOME` = `C:\Android` (đã verify M1).
- `platforms;android-34` + `build-tools;34.0.0` cài qua sdkmanager (auto-resolved bởi AGP nếu missing + accepted licenses).

## File layout

```
apps/test-debuggable-src/
├── settings.gradle.kts
├── build.gradle.kts                 # root, plugins declared
├── gradle.properties
├── gradle/wrapper/
│   ├── gradle-wrapper.properties    # checked in
│   └── gradle-wrapper.jar           # bootstrapped lần đầu, gitignored sau
├── gradlew / gradlew.bat            # bootstrapped lần đầu
└── app/
    ├── build.gradle.kts             # AGP config
    └── src/main/
        ├── AndroidManifest.xml
        └── java/com/santete/statetest/MainActivity.kt
```
