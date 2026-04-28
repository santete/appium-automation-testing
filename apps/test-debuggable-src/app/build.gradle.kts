// App module build script — debuggable APK, no signing, minSdk 24, targetSdk 34.
// Plan ref: M4 Task 13. Output: apps/test-debuggable-src/app/build/outputs/apk/debug/app-debug.apk
//
// Tradeoff: minSdk 24 (Android 7.0) — đủ cho dev device hiện tại + uiautomator2.
// targetSdk 34 (Android 14) — match latest stable, không lock-out new policies.

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.santete.statetest"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.santete.statetest"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        getByName("debug") {
            isDebuggable = true
            isMinifyEnabled = false
            // KHÔNG sign release config — debug build dùng default debug keystore.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
}
