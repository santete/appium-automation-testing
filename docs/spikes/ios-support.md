# Spike — iOS support cross-platform (M6 Task 8, Decision 9)

**Status:** ⏳ Spike code shipped, **execution pending** (chờ Phuc upload iOS .ipa lên BS).
**Time-box:** 4-6h hard cap (Decision 9). Beyond → defer scope, không expand spike.
**Owner:** Phuc DN (manual run + verdict).
**Date created:** 2026-05-01.
**Date executed:** _(điền khi run)_

---

## 1. Spike question

> Có thể chạy 1 smoke test (login) trên BS iPhone 14 simulator dùng cùng framework code (LoginPage selector strategy + AssertionRunner) **mà không phải fork code path** không?

Trả lời câu hỏi: cross-platform coverage M7+ tốn bao nhiêu effort thật sự? Hiện tại estimate là 1-2 sprint nhưng chưa có data.

## 2. Setup checklist

### Prerequisites (Phuc làm 1 lần)

- [ ] BS account active (Decision 4 — đã hoàn tất 2026-05-01).
- [ ] Build/grab Sauce Demo iOS .ipa (https://github.com/saucelabs/my-demo-app-ios/releases hoặc build local Xcode).
- [ ] Upload .ipa lên BS App Automate:
  ```
  curl -u "$BS_USERNAME:$BS_ACCESS_KEY" \
    -X POST https://api-cloud.browserstack.com/app-automate/upload \
    -F "file=@./apps/SauceLabs-Demo-App.ipa"
  ```
- [ ] Copy `bs://...` URL → `.env.local` `BS_IOS_APP_URL=bs://abc123...`

### Run

```
npx wdio run ./src/config/wdio.bs.ios.ts
```

Spec scope: `tests/smoke/login-ios.spike.ts` only (1 it).

## 3. Acceptance criteria (spike-specific)

Spike PASS nếu:
- [ ] Test connect BS iOS hub thành công.
- [ ] Login flow execute (typing + click).
- [ ] Cart icon visible post-login (assertion match).
- [ ] Total runtime < 5 phút (no timeout, no hang).

Spike PARTIAL nếu:
- [ ] Connect OK, login OK, **but** assertion selector mismatch → cần map iOS-specific accessibility ID.
- [ ] Hoặc: framework hook (e.g., `LogCapture`, `appium-uiautomator2-driver`-specific) throw vì iOS không cùng API surface.

Spike FAIL nếu:
- [ ] BS connection fail (auth, app URL invalid).
- [ ] Framework code crash trước khi reach test body.

## 4. Verdict template (điền khi xong)

```
Verdict: [PASS | PARTIAL | FAIL]
Run timestamp: [ISO datetime]
BS session URL: [link]
Total wall-clock: [N phút]

Observations:
  - [observation 1]
  - [observation 2]
  ...

Gap analysis (cho full iOS coverage M7+):
  - [gap 1: e.g., "LogCapture chỉ hỗ trợ Appium UiAutomator2 logs, không có
     XCUITest log adapter — cần viết IosLogCaptureDeps. Effort: ~4h."]
  - [gap 2: e.g., "AC_LOGIN_001 contract reuse được không cần edit — selector
     ~test-* match cả 2 platform vì Sauce Demo dùng accessibility ID chuẩn."]
  ...

Effort estimate cho full iOS regression (M7+):
  [X sprint hoặc Y hours, justification]

Recommendation:
  [Implement M7] / [Defer M8+] / [Drop, Android-only production]
```

## 5. Out of scope (don't expand without sign-off)

- iOS regression suite full (15+ spec) — defer.
- iOS visual regression — defer.
- iOS perf test — defer.
- iOS device matrix (iPad, multiple iOS version) — defer.

Nếu spike PASS và muốn implement full iOS, mở plan riêng `docs/plans/M7-ios-coverage.md` thay vì stretch M6 scope.

## 6. References

- M6 plan Decision 9: `docs/plans/M6-optimization.md` §4.
- iOS spec file: `src/config/wdio.bs.ios.ts`.
- iOS spike test: `tests/smoke/login-ios.spike.ts`.
- BS iOS docs: https://www.browserstack.com/docs/app-automate/appium/getting-started/ios
