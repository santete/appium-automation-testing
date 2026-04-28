# Runbook — Local execution (M1 → M4)

> Mục tiêu: Junior engineer pull repo → chạy được smoke + regression + negative + nightly suites trên máy local (Windows 11) bằng emulator hoặc real device.
> Spec: `automation_testing_requirement.md` §11.
> Plan: `docs/plans/M1-foundation.md`, `docs/plans/M4-cicd.md`.

---

## TL;DR (cho người đã setup xong)

```bash
# Real device qua USB (đã enable USB debugging + adb authorized):
adb devices                       # device id phải xuất hiện
npm run test:smoke                # ~30s
npm run test:regression           # ~1.5 phút (mỗi spec)
npm run test:negative             # ~1 phút
npm run test:nightly              # ~1.5 phút

# Emulator (AVD Pixel_6_API_33 đang chạy):
emulator -avd Pixel_6_API_33 &    # nếu chưa chạy
npm run test:smoke
```

> Nếu chưa setup → đọc §1 → §6 trước. §11 mô tả cách switch giữa device và emulator.

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

---

## 11. Real device qua USB (alternative cho emulator)

Real device cho speed (UI animation thật) + reproducibility tránh emulator quirks.

### 11.1 Chuẩn bị device

1. **Settings → About phone** → tap **Build number** 7 lần → Developer options unlock.
2. **Settings → Developer options** → enable **USB debugging**.
3. Nối USB → trên device popup *"Allow USB debugging from this computer?"* → tick **Always allow** → OK.

### 11.2 Verify adb thấy device

```bash
adb devices
# → List of devices attached
#   R5CW20XXXXX   device         ← device id (KHÔNG phải "unauthorized")
```

> Nếu hiện `unauthorized` → unplug + replug + accept popup lại.
> Nếu hiện `offline` → `adb kill-server && adb start-server`.

### 11.3 Cập nhật `.env.local`

```bash
# .env.local — switch từ emulator sang device thực
ANDROID_DEVICE_NAME=R5CW20XXXXX     # ← device id từ `adb devices`
ANDROID_PLATFORM_VERSION=14         # ← Android version trên device, vd. 14
APP_PATH=apps/SauceLabs-Demo-App.apk
```

### 11.4 Pre-install vs auto-install

Mặc định `wdio.local.ts` dùng `appium:noReset: false` + `appium:app` → Appium tự install + uninstall app mỗi session.

Nếu muốn pre-install (debug nhanh hơn):

```bash
adb install -r apps/SauceLabs-Demo-App.apk
```

Sau pre-install, có thể tạm comment `appium:app` trong wdio config + add `'appium:appPackage': 'com.swaglabsmobileapp'` + `'appium:appActivity': 'com.swaglabsmobileapp.MainActivity'`. Không bắt buộc — default flow hoạt động.

---

## 12. Emulator advanced — chuyển AVD, rebuild máy mới

### 12.1 List AVD hiện có

```bash
emulator -list-avds
# → Pixel_6_API_33
```

### 12.2 Tạo AVD mới qua CLI (không cần mở Android Studio)

```bash
sdkmanager "system-images;android-33;google_apis;x86_64"
avdmanager create avd \
  -n Pixel_7_API_34 \
  -k "system-images;android-33;google_apis;x86_64" \
  -d pixel_7
```

Update `.env.local`:

```bash
ANDROID_DEVICE_NAME=Pixel_7_API_34
ANDROID_PLATFORM_VERSION=14
```

### 12.3 Khởi động emulator headless (CI-style local)

```bash
emulator -avd Pixel_6_API_33 -no-window -no-audio -no-boot-anim &
adb wait-for-device
adb shell getprop sys.boot_completed   # phải in '1' trước khi run test
```

---

## 13. Chạy từng suite

| Suite | Command | Thời lượng (1 device) | Khi dùng |
|-------|---------|------------------------|---------|
| smoke | `npm run test:smoke` | ~30s | PR gate (CI) + sanity local |
| regression | `npm run test:regression` | ~2 phút | Trước merge feature lớn |
| negative | `npm run test:negative` | ~1 phút | Verify error handling |
| nightly | `npm run test:nightly` | ~1.5 phút | Daily cron + edge case verify |

Chạy 1 spec cụ thể:

```bash
npx wdio run src/config/wdio.local.ts \
  --spec tests/regression/purchase-happy-path.spec.ts
```

---

## 14. Troubleshooting bổ sung (M2-M4)

| Symptom | Nguyên nhân | Fix |
|---------|-------------|-----|
| `MissingContractError: AC_*.yaml not found` | YAML chưa có trong `src/contracts/` | Verify file tồn tại + tên contract khớp `runContractById` arg |
| `process_alive not configured for AC_*` | Negative checker thiếu `isProcessAlive` callback | OK nếu contract không có check `process_alive` — error chỉ throw khi runner gọi (defensive) |
| Logcat không capture được `~test-Error message` | `getLogs('logcat')` Sauce Demo trả empty trên một số device | Dùng `adb logcat -c && adb logcat -d` thủ công verify; nếu empty là device-side issue, không phải framework bug |
| Quarantine skip toàn bộ test | `quarantine.json` có entry hết hạn | `npm run check:quarantine` xem deadline; remove entry hoặc renew |
| State checker test fail trên Sauce Demo | Sauce Demo release-signed, không cho `EXEC` qua Appium | Đây là known D4 — dùng `apps/state-test-debug.apk` build qua `npm run build:test-apk` (xem README app) |

---

## 15. Generate + view Allure report

```bash
npm run allure:generate    # build static HTML từ allure-results/
npm run allure:open        # mở browser local (port random)
```

Allure attaches:
- Screenshot on failure (afterTest hook)
- Page source dump XML
- Multi-layer assertion verdict (status + per-check result)
- Logcat samples khi negative checker chạy
