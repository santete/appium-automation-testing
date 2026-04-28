# Runbook — M1 Foundation Setup

> Mục tiêu: Junior engineer pull repo → chạy được smoke test trong **30 phút** trên Windows 11.
> Spec: `automation_testing_requirement.md` §11 Phase 1.
> Plan: `docs/plans/M1-foundation.md`.

---

## 0. Tổng thời gian dự kiến

| Bước | Thời gian | Skip nếu |
|------|-----------|----------|
| 1. Cài Java JDK 17 | 5 phút | Đã có `java -version` returns 17+ |
| 2. Cài Android Studio + SDK | 15 phút (gồm download) | Đã có |
| 3. Tạo AVD emulator | 5 phút | Đã có Pixel_6_API_33 |
| 4. Cài Appium 2 + driver | 3 phút | Đã có `appium -v` 2.x |
| 5. Tải Sauce Labs Demo App | 1 phút | — |
| 6. Setup project | 2 phút | — |
| 7. Run smoke test | 2 phút | — |
| **Total** | **~33 phút** | |

---

## 1. Cài Java JDK 17

Appium 2 + Android SDK yêu cầu Java JDK 11+. Khuyến nghị **Eclipse Temurin 17 LTS**.

### Download & install

1. Tải từ https://adoptium.net/temurin/releases/?version=17
2. Chọn `Windows x64 .msi` → install với option **Set JAVA_HOME** và **Add to PATH** đều bật.

### Verify

Mở **Git Bash** mới (không dùng terminal cũ — env vars chưa load):

```bash
java -version
# → openjdk version "17.0.x" ...

echo $JAVA_HOME
# → /c/Program Files/Eclipse Adoptium/jdk-17.0.x-hotspot
```

Nếu `JAVA_HOME` rỗng: vào **System Properties → Environment Variables**, thêm system var `JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`.

---

## 2. Cài Android Studio + SDK

### Download & install

1. Tải Android Studio: https://developer.android.com/studio
2. Install với option mặc định → chọn **Android SDK** + **Android SDK Platform** + **Android Virtual Device**.
3. Mở Android Studio → **More Actions → SDK Manager** → tab **SDK Platforms**:
   - Tick **Android 13.0 (API 33)** → Apply.
4. Tab **SDK Tools**:
   - Tick **Android SDK Platform-Tools**, **Android SDK Build-Tools 33**, **Android Emulator** → Apply.

### Setup env vars

Default SDK location: `C:\Users\<you>\AppData\Local\Android\Sdk`

Thêm vào **System Environment Variables**:

```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
```

Thêm vào **PATH**:

```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\tools\bin
```

### Verify

Mở Git Bash mới:

```bash
adb --version
# → Android Debug Bridge version 1.0.41 ...

emulator -version
# → Android emulator version 33+ ...

echo $ANDROID_HOME
# → /c/Users/<you>/AppData/Local/Android/Sdk
```

---

## 3. Tạo AVD emulator

1. Android Studio → **More Actions → Virtual Device Manager**.
2. **Create Device** → chọn **Pixel 6** → Next.
3. System Image → tab **Recommended** → chọn **Tiramisu (API 33)** → Download → Next.
4. AVD Name: `Pixel_6_API_33` (phải KHỚP với `ANDROID_DEVICE_NAME` trong `.env.local`).
5. Finish → start emulator → đợi boot xong (lần đầu ~3-5 phút).

### Verify

```bash
adb devices
# → List of devices attached
#   emulator-5554   device
```

---

## 4. Cài Appium 2 server + UiAutomator2 driver

```bash
npm install -g appium@^2.11.0
appium driver install uiautomator2

# Verify
appium -v
# → 2.11.x

appium driver list --installed
# → uiautomator2@x.y.z [installed (npm)]
```

### Verify environment với appium-doctor

```bash
npm install -g @appium/doctor
appium-doctor --android
```

Output **TẤT CẢ phải ✓** trước khi tiếp tục:
- ✓ Node version
- ✓ ANDROID_HOME
- ✓ JAVA_HOME
- ✓ adb / android / emulator exist

Nếu có ✗ → fix từng cái theo gợi ý của doctor.

---

## 5. Tải Sauce Labs Demo App

```bash
mkdir -p apps
curl -L -o apps/SauceLabs-Demo-App.apk \
  https://github.com/saucelabs/sample-app-mobile/releases/download/2.7.1/Android.SauceLabs.Mobile.Sample.app.2.7.1.apk
```

Verify file: `ls -lh apps/SauceLabs-Demo-App.apk` → ~25 MB.

> Nếu URL chết: vào https://github.com/saucelabs/sample-app-mobile/releases lấy `.apk` mới nhất, đổi tên thành `SauceLabs-Demo-App.apk`.

---

## 6. Setup project

```bash
# Copy env template (chứa creds Sauce Demo public — DEBT D2, fix M3)
cp .env.example .env.local

# Install deps
npm install

# Verify type check + lint
npm run typecheck
npm run lint
```

`npm install` lần đầu mất 2-3 phút.

---

## 7. Run smoke test

**Pre-check:**
- Emulator `Pixel_6_API_33` đang chạy (`adb devices` thấy nó).
- `.env.local` có giá trị đúng (đặc biệt `ANDROID_DEVICE_NAME`, `APP_PATH`).

```bash
npm run test:smoke
```

Expected output:
```
[mocha] TC_LOGIN_001 — Smoke: Login with valid credentials
  ✓ should login successfully and land on Products screen (≈8s)

1 passing (≈12s)
```

---

## 8. Xem Allure report

```bash
npm run allure:generate
npm run allure:open
```

Browser mở report local (port random) → tab **Suites** → click test → xem step log + screenshot.

Test fail → tab **Defects** sẽ có failure screenshot tự động (verify bằng cách sửa assertion trong `tests/smoke/login.spec.ts` thành `false` rồi run lại).

---

## 9. Troubleshooting

| Symptom | Nguyên nhân thường gặp | Fix |
|---------|------------------------|-----|
| `Error: spawn appium ENOENT` | Appium chưa global install | `npm i -g appium@^2` |
| `Could not find a connected Android device` | Emulator chưa start | Mở Virtual Device Manager → start AVD |
| `An unknown server-side error... Could not install app` | `APP_PATH` sai | Verify `apps/SauceLabs-Demo-App.apk` tồn tại + path trong `.env.local` |
| `Element not found: ~test-Username` | Locator app version mismatch | Verify version `.apk` 2.7.x; nếu khác → mở Appium Inspector check accessibility id thực tế |
| `JAVA_HOME is not set` | Env var chưa apply | Đóng tất cả Git Bash, mở mới |
| Test fail với `waitForVisible timeout` | Emulator chậm | Tăng `DEFAULT_WAIT_TIMEOUT` trong `.env.local`, hoặc enable HAXM/WHPX |

### Hard reset emulator

```bash
adb emu kill
emulator -avd Pixel_6_API_33 -wipe-data
```

---

## 10. Sau khi pass smoke test

Verify acceptance test M1 (`docs/plans/M1-foundation.md` §2):

- [ ] Smoke test pass < 5 phút sau cold start
- [ ] Allure report mở được + có screenshot/log
- [ ] Sửa assertion sai cố ý → on-fail screenshot xuất hiện trong Allure
- [ ] `npm run lint` pass — không có anti-pattern
- [ ] Smoke test chạy 5 lần liên tục → 5/5 pass

Nếu tất cả ✓ → báo lại để mark M1 status 🟢 và start planning M2.
