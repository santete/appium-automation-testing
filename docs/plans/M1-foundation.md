# M1 — Foundation

> Implementation plan cho milestone M1. Workflow đầy đủ xem `docs/plans/README.md`.

## Metadata

| Field | Value |
|-------|-------|
| Milestone ID | M1 |
| Spec section | `automation_testing_requirement.md` §11 Phase 1 |
| Status | 🟢 Done (acceptance test passed 2026-04-27) |
| Plan author | Claude + Phuc DN |
| Plan version | v1.0 |
| Created | 2026-04-27 |
| Sign-off date | 2026-04-27 |
| Sign-off by | Phuc DN |
| Target start | 2026-04-27 |
| Target end | 2026-05-18 (3 tuần) |
| Actual start | 2026-04-27 |
| Actual end | 2026-04-27 |

---

## 1. Goal

Setup hạ tầng project cơ bản (TypeScript + WDIO + Appium + Allure) và chạy được **1 smoke test e2e cho login flow** trên Android local emulator. Đây là **reference implementation** cho mọi pattern bắt buộc (Page Object, explicit wait, no-pause, Allure on-fail screenshot).

## 2. Done criteria (acceptance test)

> Junior engineer pull repo, làm theo `docs/runbook.md`, chạy được test trong **30 phút** mà không cần ask thêm.

**Acceptance test cụ thể:**
1. Fresh machine (Windows 11) clone repo → chạy `npm install` thành công < 5 phút.
2. Theo runbook → setup Appium server + Android emulator < 15 phút.
3. Chạy `npm run test:smoke` → 1 test pass < 5 phút (cold start emulator excluded).
4. Allure report generate được + mở trong browser xem screenshot/log.
5. Cố tình fail test (sửa assertion sai) → verify on-fail screenshot tự động capture vào Allure.
6. Audit code: KHÔNG có `browser.pause()`, mọi wait đều có `timeoutMsg`, locator dùng accessibility id.

## 3. Scope

### In scope
- Project scaffold: `package.json`, `tsconfig.json`, ESLint, Prettier, `.gitignore`
- WDIO 8 + Appium 2 setup cho **Android emulator local**
- 1 Page Object mẫu (`LoginPage`)
- 1 smoke test login flow
- Wait helper + logger utilities (no full observability stack — đó là M2/M5)
- Allure reporter với on-fail screenshot
- `docs/runbook.md` setup từ zero
- `README.md` quick start

### Out of scope (explicit — defer)
- ❌ **iOS testing** — cần macOS host hoặc cloud farm; Windows 11 không chạy được local. **Defer đến M4** (qua BrowserStack/Sauce Labs).
- ❌ Assertion Contract / multi-layer validation (M2 deliverable)
- ❌ Factory / account pool (M3 deliverable)
- ❌ CI/CD setup (M4)
- ❌ API client + state checker (M2)
- ❌ Test data fixtures phức tạp — M1 chỉ cần 1 user hardcode trong `.env.local` (sẽ refactor ở M3)
- ❌ Screenplay pattern — M1 chỉ Page Object cơ bản, Screenplay khi flow phức tạp ở M2+

> Lưu ý: smoke test M1 sẽ vi phạm tạm thời nguyên tắc "multi-layer assertion" và "no hardcoded credential" của spec — đây là **chấp nhận được trong M1** vì hạ tầng cho việc này chưa có. **M2 và M3 sẽ refactor.** Plan này phải document rõ debt này.

## 4. Technical decisions

### Decision 1: Platform target cho M1
- **Question (ROADMAP):** App target: iOS / Android / both?
- **Constraint:** User OS = Windows 11 → không chạy iOS Appium local được.
- **Options:**
  - A: Android only local + defer iOS đến M4 cloud
  - B: Cài macOS VM hoặc dual-boot — high friction
  - C: Setup BrowserStack từ M1 cho iOS — bypass M4 dependency, nhưng tăng cost/complexity sớm
- **Đề xuất:** **Option A** — Android local only. M4 thêm iOS qua cloud. Lý do: minimum friction, đúng nguyên tắc "1 thứ chạy được" của Phase 1 spec.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27

### Decision 2: App under test
- **Question (ROADMAP):** Test app cụ thể nào (real app vs demo app)?
- **Options:**
  - A: **Sauce Labs Demo App** (Android `.apk` public) — clean reference, login flow có sẵn, không cần backend
  - B: **App thật của team** — đúng business value nhưng cần build + credentials
  - C: WebdriverIO sample native demo
- **Đề xuất:** **Option A (Sauce Labs Demo App)** cho M1 — giúp validate framework chạy được trước khi đụng app phức tạp. M2/M3 swap sang app thật.
- **Status:** ⏳ Cần confirm — bạn có app cụ thể đã muốn test ngay từ M1 không?

### Decision 3: App source location
- **Question (ROADMAP):** App source: build .ipa/.apk có sẵn / từ store / build từ source?
- **Đề xuất (nếu Decision 2 = A):** Download `.apk` từ Sauce Labs GitHub release → commit vào `apps/` (gitignored) hoặc download trong setup script.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27

### Decision 4: Account credentials
- **Question (ROADMAP):** Account credentials cho login flow lấy từ đâu?
- **Đề xuất (nếu Decision 2 = A):** Sauce Labs Demo App có sẵn 5 user public (`bob@example.com / 10203040`), hardcode vào `.env.local` cho M1 (sẽ chuyển sang factory/pool ở M3).
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27

### Decision 5: Local device
- **Question (ROADMAP):** Local emulator hay real device cho M1?
- **Đề xuất:** **Android emulator** (AVD trong Android Studio) — không cần phần cứng, dễ reset. Real device thử ở M3+ khi có account pool.
- **Status:** ⏳ Cần confirm — bạn đã cài Android Studio chưa?

### Decision 6: Test framework runner
- **Question (mới):** WDIO support Mocha / Jasmine / Cucumber. Chọn cái nào?
- **Đề xuất:** **Mocha** (default WDIO) + Chai assertions. Lý do: ecosystem rộng nhất, không cần BDD overhead ở M1. Cucumber nếu sau này team cần BDD có thể add ở M2+.
- **Status:** ⏳ Cần confirm

### Decision 7: Project name + repo
- **Question (mới):** Tên npm package + có Git repo riêng không?
- **Đề xuất:** Package name `mobile-automation`, repo init `git init` trong thư mục hiện tại (chưa push remote).
- **Status:** ⏳ Cần confirm

### Decision 8: Node version
- **Question (mới):** Node version requirement?
- **Đề xuất:** **Node 20 LTS** (WDIO 8 yêu cầu Node ≥ 18, Node 20 stable nhất 2026).
- **Status:** ⏳ Cần confirm

## 5. Task breakdown

| # | Task | Deliverable | Estimate | Status | Skill |
|---|------|-------------|----------|--------|-------|
| 1 | Init npm project + install deps | `package.json` | 2h | 🟡 file ready, awaiting `npm install` | — |
| 2 | TypeScript config | `tsconfig.json` | 1h | 🟢 | — |
| 3 | Linter + formatter | `.eslintrc.cjs`, `.prettierrc`, `.gitignore` | 1h | 🟢 (no-pause rule enforced) | — |
| 4 | WDIO config local Android | `src/config/wdio.local.ts` | 3h | 🟢 | `test-implement` |
| 5 | Wait helper utility | `src/utils/wait.ts` | 2h | 🟢 | `test-implement` |
| 6 | Logger utility | `src/utils/logger.ts` | 1h | 🟢 | `test-implement` |
| 7 | Login Page Object | `src/pages/LoginPage.ts` | 2h | 🟢 | `test-implement` |
| 8 | Login smoke spec | `tests/smoke/login.spec.ts` | 3h | 🟢 (debt D1+D2 noted in header) | `test-implement` |
| 9 | Allure reporter integration | reporter + on-fail hook trong wdio.local.ts | 2h | 🟢 | `test-implement` |
| 10 | Runbook documentation | `docs/runbook.md` | 3h | 🟢 | — |
| 11 | README quick start | `README.md` | 1h | 🟢 | — |
| 12 | End-to-end verification (acceptance test) | report evidence | 2h | 🟢 5/5 pass + on-fail screenshot verified | — |

**Total estimate:** ~23h dev time (~3 ngày làm việc), buffer cho 3 tuần kế hoạch.

## 6. Dependencies

### Upstream
- [x] Bạn answer 8 decisions ở section 4 (signed-off 2026-04-27)
- [x] Node ≥20 LTS — verified Node v22.18.0 trên máy
- [ ] Java JDK 17+ cài sẵn — **CHƯA CÓ** (verified `java` not in PATH 2026-04-27); user cần cài theo runbook
- [ ] Android Studio + AVD Manager — **CHƯA CÓ** (verified `adb` not in PATH); user cần cài theo runbook
- [ ] Appium server global (`npm i -g appium`) — sẽ document trong runbook

### Downstream
- M2 Validation Framework không thể start cho đến khi M1 done.

### External
- Tải `.apk` Sauce Labs Demo App (nếu chọn Decision 2 = A)
- Appium driver `uiautomator2` (cho Android)

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Appium setup phức tạp trên Windows | High | High | Document chi tiết trong runbook, dùng `appium doctor` để verify |
| Emulator chậm / không boot | Medium | Medium | Hardware Acceleration (HAXM/WHPX), AVD config "cold boot disabled" |
| Java/Android SDK PATH conflict | Medium | High | Runbook ghi rõ env var (`JAVA_HOME`, `ANDROID_HOME`, `PATH`) |
| WDIO 8 + Appium 2 breaking change so với tutorial cũ | Medium | Medium | Reference docs WDIO + Appium 2 mới nhất, không copy code cũ |
| Sauce Labs Demo App URL/build thay đổi | Low | Low | Pin version trong runbook |

## 8. Test plan (verify deliverables)

- [ ] Acceptance test 6 bước trong section 2 pass
- [ ] Code audit: chạy ESLint pass, không có `pause()` trong codebase
- [ ] Smoke test chạy 5 lần liên tục → pass 5/5 (tránh flaky baseline)
- [ ] Allure report show: screenshot on-fail, video (nếu có), step log

## 9. Rollback plan

Nếu phải hủy M1:
- Xóa `node_modules/`, `package-lock.json`
- Giữ lại spec + skills + ROADMAP để re-attempt sau
- Document lessons learned trong section 13

## 10. Sign-off checklist

Trước khi chuyển status → 🔵 Plan ready:

- [x] 8 decisions ở section 4 đều có answer
- [x] Acceptance test rõ ràng, có thể verify
- [x] Scope out-of-scope explicit (đặc biệt iOS defer)
- [x] Risks đã thảo luận
- [x] Stakeholder approve plan v1.0
- [x] Debt items tracked vào ROADMAP Debt log (D1, D2)

## 11. Status updates (weekly)

| Date | Update | Blockers |
|------|--------|----------|
| 2026-04-27 | Plan draft v0.1 created, đang chờ stakeholder answer 8 decisions | Pending answers |
| 2026-04-27 | Plan v1.0 signed-off bởi Phuc DN — accept all 8 đề xuất, 2 debt items (D1, D2) tracked vào ROADMAP. Ready to execute. | None |
| 2026-04-27 | Tasks 2-11 done (code scaffold + runbook + README). Task 1 ready file, awaiting user `npm install`. Task 12 awaiting user verify acceptance test. | User cần cài Java JDK 17 + Android Studio + AVD theo runbook §1-3 trước khi run test |
| 2026-04-27 | All 9 setup steps run via CLI (Java 17 + Android cmdline-tools standalone + AVD Pixel_6_API_33 + Appium 2.19 + uiautomator2@3.7.0 + Sauce Demo apk + npm install). Smoke pass; fixed 4 issues during run (xem §13). Acceptance test: 5/5 pass (avg 30s), fail-on-purpose → screenshot + page source attached vào Allure (verified). M1 → 🟢. | None |

## 12. Plan revisions

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| — | — | — | — |

## 13. Closure

**Closed:** 2026-04-27 by Phuc DN.

- [x] Tất cả deliverables ở section 5 = 🟢
- [x] Acceptance test pass với evidence:
  - Smoke run 5/5 pass (durations 34.1 / 31.7 / 28.2 / 27.5 / 27.9 s)
  - Fail-on-purpose run → 2 PNG attachments + 1 XML page source in Allure results (afterTest hook works)
  - `npm run lint` pass (no `pause()`, no `setTimeout` in test code)
  - `npm run typecheck` pass
- [x] ROADMAP.md status M1 = 🟢
- [x] Lessons learned cho M2 (đã copy vào ROADMAP M1 section):
  1. **Pin Appium driver versions explicit:** WDIO 8 + Appium 2.19 chỉ tương thích `appium-uiautomator2-driver@3.x` (driver 4.x yêu cầu Appium 3 RC). M2 nếu cần upgrade phải đồng bộ.
  2. **Mobile-native không có `el.isClickable()`:** wait helpers phải compose `isDisplayed && isEnabled`. Tài liệu hóa trong M2 wait API.
  3. **`appWaitActivity: '*'`** là default an toàn cho native apps có splash → activity transition nhanh; không nên hardcode activity name vì rotation thay đổi giữa version app.
  4. **JAVA_HOME phải set User scope** (không chỉ session) để allure-commandline / sdkmanager / avdmanager đều thấy. Runbook §1 đã đúng.
  5. **Sauce Demo creds:** `standard_user / secret_sauce` (không phải `bob@example.com / 10203040` như guess ban đầu). Runbook + .env.example đã update.
  6. **Debt D1 (single-layer assertion):** smoke spec hiện chỉ check `~test-Cart` visible ở UI. M2 phải refactor qua Assertion Contract YAML + multi-layer (UI + (mock) API + state). Đây là acceptance test M2.
  7. **Debt D2 (hardcoded creds):** `.env.local` vẫn lưu plain text. M3 phải migrate qua UserFactory + account pool, xóa block credentials trong env file.
