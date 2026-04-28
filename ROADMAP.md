# Roadmap — Mobile Automation Testing Framework

> Master tracker cho 6 milestones implement framework từ spec `automation_testing_requirement.md` §11.
> **Workflow bắt buộc:** mỗi milestone phải có **Implementation Plan chi tiết** (`docs/plans/MX-<name>.md`) được sign-off **TRƯỚC** khi bắt đầu code.
> Workflow đầy đủ xem `docs/plans/README.md`.

---

## Status legend

| Icon | Trạng thái |
|------|------------|
| ⬜ | Not started — chưa có plan |
| 📝 | Planning — plan đang draft |
| 🔵 | Plan ready — đã sign-off, sẵn sàng implement |
| 🟡 | In progress — đang implement |
| 🟢 | Done — đã pass done criteria |
| 🔴 | Blocked — chờ dependency / decision |

---

## Tổng quan tiến độ

| ID | Milestone | Status | Plan | Target | Actual | Blocker |
|----|-----------|--------|------|--------|--------|---------|
| M1 | Foundation | 🟢 | [M1-foundation.md](docs/plans/M1-foundation.md) | 2026-04-27 → 2026-05-18 | 2026-04-27 → 2026-04-27 | — |
| M2 | Validation Framework | 🟢 | [M2-validation-framework.md](docs/plans/M2-validation-framework.md) | 2026-04-28 → 2026-05-19 | 2026-04-27 → 2026-04-27 | — |
| M3 | Test Data & Environment | 🟢 | [M3-test-data-env.md](docs/plans/M3-test-data-env.md) | 2026-04-28 → 2026-05-12 | 2026-04-27 → 2026-04-28 | — |
| M4 | CI/CD Integration | 🟡 | [M4-cicd.md](docs/plans/M4-cicd.md) | 2026-04-29 → 2026-05-20 (3 tuần) | 2026-04-28 → — | — |
| M5 | Observability & Intelligence | ⬜ | — | TBD | — | — |
| M6 | Optimization & Scale | ⬜ | — | TBD | — | — |

**Dependency graph:**
```
M1 → M2 → M3 → M4 → M5 → M6
       ↑     ↑
       └─ M3 có thể overlap với M2 sau khi AssertionRunner core xong
       └─ M4 cần M2 + M3 stable trước
```

---

## M1 — Foundation

**Map vào:** spec §11 Phase 1 (Week 1-3)
**Status:** 🟢 Done (2026-04-27 — acceptance test pass 5/5, on-fail screenshot verified)
**Plan file:** [docs/plans/M1-foundation.md](docs/plans/M1-foundation.md)
**Accepted debt:** D1 (single-layer assertion → trả M2), D2 (hardcoded creds → trả M3)

### Goal
Setup hạ tầng cơ bản, chạy 1 smoke test e2e end-to-end.

### Done criteria (sign-off)
> Junior engineer pull repo, làm theo `docs/runbook.md`, chạy được test trong **30 phút** mà không cần ask thêm.

### Deliverables
- [x] `package.json` với deps: WDIO 8+, Appium 2, TypeScript 5+, Chai expect, Allure reporter
- [x] `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`, `.gitignore`
- [x] `src/config/wdio.local.ts` — capabilities cho Android emulator (iOS defer M4)
- [x] `src/pages/LoginPage.ts` — 1 Page Object mẫu (theo pattern §3 step 4a)
- [x] `tests/smoke/login.spec.ts` — 1 smoke test e2e (login flow)
- [x] `src/utils/wait.ts` — explicit wait helper (no `pause()`)
- [x] `src/utils/logger.ts` — structured logger
- [x] Allure reporter integrated, screenshot on-fail tự động (verified 2026-04-27)
- [x] `docs/runbook.md` — setup hướng dẫn từ zero
- [x] `README.md` — overview + quick start

### Plan checklist (cần fill trong plan file)
- App target: iOS / Android / both?
- App source: build .ipa/.apk có sẵn / từ store / build từ source?
- Test app cụ thể nào (real app vs demo app như Sauce Labs Demo)?
- Account credentials cho login flow lấy từ đâu?
- Local emulator hay real device cho M1?

### Status updates
| Date | Update |
|------|--------|
| 2026-04-27 | Plan v1.0 sign-off, code scaffold done |
| 2026-04-27 | All 9 setup steps + acceptance test passed: smoke 5/5, fail-on-purpose → screenshot + page source captured. M1 → 🟢 Done. |

### M1 lessons learned (input cho M2 plan)
- WDIO + Appium 2.19 không tương thích uiautomator2 latest; phải pin `appium-uiautomator2-driver@3.7.0`. M2/M3 nếu upgrade Appium phải đồng bộ.
- `el.isClickable()` không support trên mobile native — `waitForClickable` phải compose từ `isDisplayed && isEnabled`.
- Sauce Demo App credentials thật là `standard_user / secret_sauce` (không phải `bob@example.com`); runbook đã update.
- Sauce Demo splash activity transition nhanh → cần `appWaitActivity: '*'` + `appWaitDuration: 30000` ở capabilities.
- JAVA_HOME phải set ở **User scope** (không chỉ session) để allure-commandline tìm được Java.

---

## M2 — Validation Framework

**Map vào:** spec §11 Phase 2 (Week 4-6)
**Status:** 🟢 Done (2026-04-27 — smoke 5/5 PASS, Allure verdict + per-layer steps verified)
**Accepted debt:** D3 (AC_LOGIN_001 thiếu API layer → trả M3), D4 (StateChecker adb-shell-only → trả M3/M4)
**Plan file:** [docs/plans/M2-validation-framework.md](docs/plans/M2-validation-framework.md)
**Depends on:** M1 done

### Goal
Có Assertion Contract + multi-layer validation thực thi được.

### Done criteria (sign-off)
> Test fail có thể **chỉ rõ** fail ở UI / API / State layer nào, với evidence đầy đủ tự động.

### Deliverables
- [x] `src/utils/assertion/AssertionRunner.ts` — orchestrator parse YAML contract + execute checks (spec §5.4)
- [x] `src/contracts/_schema.ts` — Zod schema cho contract YAML (single source of truth)
- [x] `src/utils/apiClient.ts` + `ApiChecker.ts` — Axios + Zod schema validation
- [x] `src/utils/assertion/checkers/StateChecker.ts` + `adbStateCheckerDeps.ts` — shared_prefs via adb (M2 scope; D4 → M3)
- [x] Verdict computation logic theo §5.3 (critical→stop+FAIL, high→FAIL, medium→PASS_WITH_WARNINGS, low→PASS)
- [x] Soft assertion: AssertionRunner accumulates results, `attachVerdictToAllure()` emit per-step + per-layer
- [x] **[Repay D1]** `src/contracts/AC_LOGIN_001.yaml` — smoke test chạy multi-layer (3 UI + 2 Negative) qua contract
- [x] Unit tests (31) + Integration tests (6) cho AssertionRunner + checkers + loader

### Plan checklist (cần fill trong plan file)
- Severity → action mapping cụ thể (critical = stop immediately?)
- Schema validation lib: Zod / Joi / Ajv?
- State layer access: qua app's debug API hay trực tiếp DB?
- Negative assertion (no_pii in logs) implement thế nào — log capture hook?

### Status updates
| Date | Update |
|------|--------|
| 2026-04-27 | Plan v1.0 sign-off (decisions 1-9 confirmed, debt D3+D4 logged) |
| 2026-04-27 | Tasks 1-12 🟢 trong 1 session: Zod schema, contract loader, 5 checkers + DI adapters, AssertionRunner orchestrator, Allure integration, MSW integration test. **31 unit + 6 integration tests pass** (typecheck + lint clean). D1 closed (smoke test multi-layer qua AC_LOGIN_001.yaml). Task 13: 5/8 acceptance sub-points verified bằng test, 3/8 chờ device run theo `docs/runbook-M2-acceptance.md` |
| 2026-04-27 | Device acceptance done — smoke 5/5 PASS (durations: 25.0/25.1/24.7/25.2/39.9s). Allure verified: `verdict.json` attachment, 5 per-layer steps với severity prefix, labels `contract_id=AC_LOGIN_001` + `verdict=PASS` + `UI_layer=3/3 passed` + `NEGATIVE_layer=2/2 passed`. **M2 → 🟢 Done.** 2 bugs hit & fixed mid-acceptance: (i) post-login race condition (AssertionRunner không tự wait → thêm `waitForVisible('~test-Cart')` trong spec); (ii) NPE pattern broad bắt system services → đổi sang `Process:\s*com\.swaglabsmobileapp` để scope theo app crash dump. |

---

## M3 — Test Data & Environment

**Map vào:** spec §11 Phase 3 (Week 7-9), §4
**Status:** 🟢 Done (2026-04-28 — 9/9 acceptance sub-points PASS, 1 ⚠ caveat: Sauce Demo APK release-signed → D4 real-device verify carry-over M4)
**Plan file:** [docs/plans/M3-test-data-env.md](docs/plans/M3-test-data-env.md)
**Repaid debt:** D2 (hardcoded creds) ✅, D3 (path B — AC_API_DEMO_001 real API) ✅, D4 (mobile:executeScript backend) ✅ unit-level + ⚠ real-device carry-over M4
**Depends on:** M2 done (factory cần ApiClient — ✅)

### Goal
Test isolated hoàn toàn, không flaky vì data hoặc env.

### Done criteria (sign-off)
> Chạy **50 lần liên tục** suite smoke trên cùng env, **0 data conflict**, **0 env-related failure**.

### Deliverables
- [x] `src/factories/UserFactory.ts` — create + cleanup, idempotent
- [x] `src/factories/_base.ts` — abstract Factory pattern reuse được
- [x] Account pool service (in-memory + `proper-lockfile`) — `src/utils/accountPool/{AccountPool,fileLock,pool.config.json}`
- [x] `.env.example` + env loader trong `src/config/index.ts` (Zod-validated)
- [x] `src/config/wdio.staging.ts` — staging capabilities + cred từ env (skeleton, M4 wire device farm)
- [x] **[Repay D2]** Migrate smoke test M1 sang `globalThis.testAccount` (lease từ AccountPool qua `tests/_hooks/global.ts`); `.env.local` không còn `TEST_USERNAME`/`TEST_PASSWORD`
- [x] Network simulation hook — `src/utils/networkSim.ts` qua Appium `mobile:networkSpeed`
- [x] `beforeEach`/`afterEach` global hook tự động setup/cleanup — Mocha root hook plugin
- [x] **[Repay D3 path B]** `src/contracts/AC_API_DEMO_001.yaml` + `tests/api/api-demo.spec.ts` chạy real httpbin.org end-to-end; force-fail schema → verdict FAIL routing API/dev_team
- [x] **[Repay D4 unit-level]** `mobileExecuteScriptStateCheckerDeps.ts` backend qua Appium `mobile: shell`; 6 unit tests (carry-over M4: real-device verify với debuggable APK)
- [x] Cross-process concurrency integration test — `tests/integration/account-pool-concurrency.spec.ts`
- [x] 20x smoke runner script — `scripts/run-smoke-Nx.cjs` + `npm run test:smoke:20x`
- [x] Acceptance runbook — `docs/runbook-M3-acceptance.md` (9 sub-points)

### Plan checklist (đã trả lời trong plan v1.0)
- Account pool: **in-memory + file lock** (`proper-lockfile`); HTTP service defer M5+ nếu multi-host shard
- Pool size: **6** (Sauce Demo built-in users với role tag)
- Cleanup: **lease/release only** (không có create/delete API; state app handled bằng `noReset:false`)
- Env matrix: **local + staging skeleton** (BS env-driven; prod defer M6)
- Network sim: **Appium `mobile:networkSpeed`** (Android emulator built-in throttle)

### Status updates
| Date | Update |
|------|--------|
| 2026-04-27 | Plan v1.0 sign-off — 9 decisions confirmed (Decisions log row 21-29). Status → 🔵 Plan ready, sẵn sàng execute. |
| 2026-04-27/28 | 6 slices ship: Account pool + lock, UserFactory + env loader + staging skeleton, network sim + global hook + D2 repay, AC_API_DEMO_001 + D3 repay (real httpbin), `mobile:executeScript` backend + D4 repay (unit), concurrency integration + 20x runner + acceptance runbook. |
| 2026-04-28 | M3 acceptance run on emulator: smoke 20/20 PASS (mean 28.6s), edge profile login PASS (hook works), forced-fail afterEach release confirmed (pool state `inUse:false`). Sauce Demo APK release-signed → D4 real-device verify carry-over M4. Tests final: unit 54, integration 8 (+2 gated), api 1. **M3 → 🟢 Done.** Decision 10 (retry-with-poll) added. |

### M3 lessons learned (input cho M4 plan)
- Integration test phải validate "blocking semantics" cho mọi resource pool, không chỉ unit-level lease/release. Unit test với frozen-clock không stress retry path.
- Pattern: deadline timing dùng wall-clock (`Date.now()`), state file timestamps dùng DI clock. Retry-with-poll cần wall để không vướng frozen-clock unit tests.
- ESLint blanket ban (`setTimeout` no-restricted-syntax) → centralize exception qua helper file (`src/utils/sleep.ts`) thay vì rải rác `eslint-disable` comments.
- Sauce Demo prod APK = release-signed → `run-as` block + `aapt dump badging` không có `application-debuggable` line. M4 build minimal debuggable test APK hoặc coordinate app team expose debug build cho CI.
- Bash session không inherit `JAVA_HOME` + `ANDROID_HOME` từ Windows User scope → smoke spawn appium-service fail. M4 CI workflow phải set explicit env, không rely OS-level inheritance.
- Network sim throttle effect minimal trên Sauce Demo (offline app) — empirical baseline cần real backend app M4+.

---

## M4 — CI/CD Integration

**Map vào:** spec §11 Phase 4 (Week 10-12), §7
**Status:** 🟡 Awaiting acceptance (v1.1 revised 2026-04-28; Task 1-5+8-10+12-17/19 done 2026-04-28; Task 18 partial — 5/7 sub-points auto-PASS local, 1+2+3+4 cần Phuc verify GH UI, 6 cần Phuc plug Android device; Task 19 closure pending; Task 6+7+11 deferred M5)
**Plan file:** [docs/plans/M4-cicd.md](docs/plans/M4-cicd.md)
**Carry-over from M3:** D4 real-device verify (local-dev path: build minimal debuggable Kotlin test APK + run StateChecker `mobile:executeScript` backend trên dev Android device — device farm wire-up defer M5+)
**Depends on:** M3 done ✅

### Goal
Non-device tier (typecheck + lint + unit + integration + api) chạy tự động trên PR + nightly via GitHub Actions; smoke E2E giữ local-dev với PR template gate; quarantine YAML enforcement; D4 real-device repay local.

### Done criteria (sign-off — revised v1.1, 2026-04-28)
> PR mở → CI gate (typecheck + lint + unit + integration + api + quarantine deadline check) chạy **< 5 phút**, fail **block merge** (branch protection minimal: required check, không require review); D4 real-device verify pass trên dev device; smoke E2E manual verify gate (PR template checklist); Allure xem local từ artifact zip; **không wire device farm + Slack + GH Pages — defer M5**.

### Deliverables
- [x] Repo bootstrapped: `git init` + push `github.com/santete/appium-automation-testing`, default branch `main` (commit `e0eb4b9`, 2026-04-28)
- [x] `.github/workflows/ci.yml` — PR + push to main, single Linux runner, typecheck + lint + unit + integration + api (2026-04-28; quarantine deadline check Task 9 còn)
- [x] `.github/workflows/regression.yml` — cron 2AM UTC + manual dispatch, full suite + `ALLOW_NETWORK_INTEGRATION=1`, Allure artifact 30d retention (2026-04-28; xem report local từ artifact zip download)
- [x] `.github/workflows/actionlint.yml` — workflow self-lint (`docker://rhysd/actionlint`, paths-filtered, 5min timeout) (2026-04-28)
- [x] `.github/PULL_REQUEST_TEMPLATE.md` — smoke local verify checklist (honor system gate) (2026-04-28)
- [x] `src/config/wdio.bs.ts` + `wdio.sauce.ts` — config-driven stub fail-fast guard (2026-04-28)
- 🔵 ~~Allure publish GH Pages composite~~ — **DEFER M5** (Enterprise org block GH Pages; xem local từ artifact)
- 🔵 ~~Slack notification composite~~ — **DEFER M5** (Actions tab native notification đủ solo)
- [x] Branch protection setup script `scripts/setup-branch-protection.sh` (gh api PUT) + UI alternative documented `docs/runbook-pr-merge-gate.md` §3b — main only, required check `verify`, **không require review** (solo dev — Decision 7 v1.1) (2026-04-28; chờ Phuc apply trên GH)
- [x] `docs/quarantine.yaml` schema + Zod validation (`src/utils/quarantine/{schema,loader}.ts`) + custom Mocha hook (`tests/_hooks/quarantine.ts`) deadline-aware. Wired FIRST trong tất cả mocharc + WDIO configs. 21 unit test (75 total). (2026-04-28)
- [x] `scripts/check-quarantine.cjs` deadline enforcement CI step — reuse `loadQuarantine` qua `ts-node/register`, 3 paths (PASS / past-deadline FAIL / schema invalid FAIL), wired vào `ci.yml` + `regression.yml`. (2026-04-28)
- 🔵 ~~`scripts/append-duration.cjs` pipeline duration baseline tracker~~ — **DEFER M5** (M5 dashboard mới consume CSV/Gist data này)
- [x] **[Repay D4 real-device]** `apps/test-debuggable-src/` minimal Kotlin app (AGP 8.2.2 + Kotlin 1.9.22 + Gradle 8.5, package `com.santete.statetest`, MainActivity write `m4_state_test_key=ok` vào 2 prefs file) + `scripts/build-test-apk.cjs` (Gradle wrapper bootstrap → assembleDebug → copy `apps/state-test-debug.apk`) + `tests/integration/state-checker-mobile-real.spec.ts` (gated `RUN_REAL_DEVICE=1`, `webdriverio.remote()` standalone, install + launch + lookup mobile:executeScript adapter, cleanup uninstall) (2026-04-28; chờ Phuc plug device verify)
- [x] `docs/runbook-pr-merge-gate.md` (2-tầng gate + branch protection auto/UI + smoke evidence + emergency override) + `docs/runbook-M4-acceptance.md` (7 sub-points coverage map + step-by-step verify) (2026-04-28)

### Plan checklist (đã trả lời trong plan v1.0)
- CI provider: **GitHub Actions** ✓
- Repo: **`github.com/santete/appium-automation-testing`** ✓ (Q1)
- Device farm: **KHÔNG wire M4** — real device dev, config-driven stub `wdio.bs.ts`/`wdio.sauce.ts` cho M5+ (Q2)
- iOS: **defer M5+** ✓ (Q3)
- Slack: **2 channels** `#pr-failures` + `#qa-alerts` ✓ (Q4)
- Quarantine: **2 tuần default + 1 tuần grace**, past-deadline → CI fail ✓ (Q5)
- D4 APK: **minimal Kotlin app** + Gradle wrapper checked in ✓ (Q6)
- Sharding: **không sharding M4** (single CI job, suite < 1 phút) ✓ (Q7 revised post-Q2)
- Secret naming: **GH Secrets** `BS_USER`, `BS_KEY`, `SLACK_WEBHOOK_PR`, `SLACK_WEBHOOK_QA` ✓ (Q8)
- Allure: **GH Pages 30 ngày retention** ✓ (Q9)
- Branch protection: **main only**, required check `ci / verify` + 1 review ✓ (Q10)

### Status updates
| Date | Update |
|------|--------|
| 2026-04-28 | Plan v0.1 draft với 12 decisions proposed + 12 open questions surface để Phuc DN sign-off. Status → 📝 Planning. Carry-over từ M3: D4 real-device verify (build minimal debuggable test APK + integration spec). |
| 2026-04-28 | Phuc DN sign-off: Q1 = `santete/appium-automation-testing`, Q2 = KHÔNG wire device farm M4 (config-driven stub cho M5+ swap), Q3-Q12 OK. Plan revised v0.1 → v1.0: drop BS wire-up, drop sharding (single CI job), smoke E2E giữ local-dev với PR template "smoke local PASS" checkbox gate. Done criteria refactored 8 → 9 sub-points. Total estimate ~17h → ~14h, schedule 2026-04-29 → 2026-05-20. **Status → 🔵 Plan ready, sẵn sàng execute Task 1 (repo bootstrap).** |
| 2026-04-28 | **Task 1 🟢** — repo bootstrap. `git init -b main` + `.gitignore` revise (add `tmp/`, `.gradle/`, `**/build/`, `local.properties`, `.claude/settings.local.json`); 80 files staged (no creds/build artifact leak); single squashed commit `e0eb4b9` "M1+M2+M3 baseline"; remote `https://github.com/santete/appium-automation-testing.git`; `git push -u origin main` SUCCESS. **Status → 🟡 In progress.** Next: Task 2 (README badge + PR template) + Task 3 (config-driven stub `wdio.bs.ts`). Block Task 6/7 cần Phuc enable GH Pages + tạo Slack webhooks. |
| 2026-04-28 | **Task 2 + 3 🟢** — README CI + Allure GH Pages badge; `.github/PULL_REQUEST_TEMPLATE.md` với 5 checklist (auto CI gate + smoke local honor-system + multi-layer assertion + quarantine + plan-before-execute). Config-driven stubs `src/config/wdio.bs.ts` + `wdio.sauce.ts`: fail-fast guard throw khi creds empty → M5+ chỉ cần fill `.env.local` + uncomment `bstack:options`/`sauce:options` block. `.env.example` + Zod schema (`src/config/index.ts`) thêm SAUCE_* placeholder. Verify: typecheck ✅, lint ✅, unit 54/54 ✅. Next: Task 4 (CI workflow). |
| 2026-04-28 | **Task 4 + 5 🟢** — CI/Regression workflows shipped. `ci.yml`: PR + push main trigger, single ubuntu-latest job `verify`, env block set Zod-required vars + `ALLOW_NETWORK_INTEGRATION=''` (gated tests skip), `concurrency: cancel-in-progress`, Allure artifact 7d, timeout 10min. `regression.yml`: cron `0 2 * * *` UTC + `workflow_dispatch`, `ALLOW_NETWORK_INTEGRATION='1'` (real httpbin), Allure artifact 30d, timeout 30min, GH Pages deploy + Slack notify steps commented (uncomment khi Task 6+7 ship). Pause execution sau Task 5 — chờ Phuc setup Slack workspace + GH Pages. |
| 2026-04-28 | **Task 8 + 12 🟢** — Quarantine mechanism + actionlint self-lint (cả hai độc lập với Pages/Slack, ship trước trong khi Phuc setup). Task 8: `src/utils/quarantine/{schema,loader}.ts` (Zod schema validate `{test_id, reason≥10, added, deadline, owner}` + 2 refinements: deadline ≥ added và deadline ≤ added + 21 ngày = 14 default + 7 grace) + `tests/_hooks/quarantine.ts` (Mocha root hook, `fullTitle()` match → future deadline `this.skip()`, past throw error có owner/reason/extend hint) + `docs/quarantine.yaml` (entries: []) + 21 unit tests. Hook wired FIRST trong tất cả `.mocharc.*.cjs` + WDIO `mochaOpts.require` (local/staging/bs/sauce) — skip-before-lease tránh leak AccountPool slot khi quarantine skip. Task 12: `.github/workflows/actionlint.yml` self-lint dùng `docker://rhysd/actionlint:latest`, trigger paths-filtered `.github/workflows/**`, 5min timeout, concurrency cancel-in-progress. Verify: typecheck ✅, lint ✅, unit 75/75 ✅ (54 + 21 quarantine), integration ✅, api ✅. Next: Task 9 (deadline check CI script) sẵn sàng; Task 6+7 vẫn block chờ Phuc Pages + Slack. |
| 2026-04-28 | **Plan revision v1.0 → v1.1 — solo-local focus.** GH Pages bị Enterprise org block khi Phuc check; Vercel alternative không justify cho solo dev (anh tự xem report). Phuc DN chốt: "kênh nhận thông tin cảnh báo này nọ setup sau, dashboard chưa share link được thì xem local, tập trung xử lý cho hoàn thiện sản phẩm có thể chạy solo ở local". **Defer Task 6 (Allure host) + Task 7 (Slack notify) + Task 11 (pipeline duration tracker) sang M5.** Decision 7 revised: branch protection drop "1 review required" (solo workflow). Done criteria 9 → 7 sub-points. Estimate ~14h → ~10h. M4 còn lại: Task 9, 10 (minimal), 13-15 (D4), 16, 17-19. Sản phẩm M4 final: framework chạy được solo local end-to-end (PR + nightly auto + smoke gate manual + D4 verified). |
| 2026-04-28 | **Task 9 🟢** — Quarantine deadline check CI gate. `scripts/check-quarantine.cjs` reuse `loadQuarantine` qua `ts-node/register/transpile-only` (single source of truth). 3 paths verify: empty entries → exit 0 PASS, past-deadline → exit 1 FAIL output owner/reason/deadline, schema invalid → exit 1 FAIL với issue path. Wired vào `ci.yml` + `regression.yml` step sau Lint trước Unit. `npm run check:quarantine` script alias. `regression.yml` cleanup Task 6/7 placeholder → note plan v1.1 defer M5. Verify local: typecheck ✅, lint ✅, unit 75/75 ✅, check:quarantine ✅ all 3 paths. Next: Task 10 (branch protection minimal qua gh api), Task 13-15 (D4 Kotlin APK + integration spec — confirm prereqs trước). |
| 2026-04-28 | **Task 10 + 13-17 🟢 (autonomous batch per upfront approval).** (10) `scripts/setup-branch-protection.sh` gh api PUT minimal config + UI alternative trong runbook merge-gate. (13) `apps/test-debuggable-src/` Kotlin app: AGP 8.2.2 + Kotlin 1.9.22 + Gradle 8.5, minSdk 24/targetSdk 34, package `com.santete.statetest`, MainActivity write `m4_state_test_key=ok` vào default prefs + custom `state_test_prefs.xml`. (14) `scripts/build-test-apk.cjs` bootstrap Gradle wrapper từ `gradle/gradle@v8.5.0` (Gradle CLI chưa cài), idempotent skip, run assembleDebug, copy stable path `apps/state-test-debug.apk`. (15) `tests/integration/state-checker-mobile-real.spec.ts` gated `RUN_REAL_DEVICE=1`, `webdriverio.remote()` standalone Appium, install + launch state-test, lookup mobile:executeScript adapter PASS + negative absent-key case, cleanup uninstall + deleteSession. (16) `docs/runbook-pr-merge-gate.md` 7-section: 2-tầng gate + branch protection auto/UI + smoke evidence + quarantine discipline + emergency override. (17) `docs/runbook-M4-acceptance.md` 7-sub-point coverage map + verify procedures (auto + GH UI manual + device). Verify local Task 18 partial: typecheck ✅, lint ✅, check:quarantine ✅ all 3 paths re-verified, unit 75/75 ✅, integration 8 passing + 4 pending (2 gated httpbin + 2 gated D4 device), api 1/1 ✅. **Next: Phuc apply 5 manual checks (Task 18 sub-point 1+2+3+4 GH UI + 6 device) → mark M4 🟢.** |

---

## M5 — Observability & Intelligence

**Map vào:** spec §11 Phase 5 (Week 13-16), §6 + §7.4-7.8
**Status:** ⬜ Not started
**Plan file:** _chưa tạo — sẽ ở `docs/plans/M5-observability.md`_
**Depends on:** M4 done (cần dữ liệu run từ CI để build dashboard)

### Goal
Auto-classify failure + dashboard trends + knowledge base + self-healing suggestion.

### Done criteria (sign-off)
> Failure mới → auto-classify với **confidence > 0.9** + suggest fix + KB pattern matched, **không cần human classify thủ công** cho 80% case.

### Deliverables
- [ ] Grafana + InfluxDB stack (hoặc ReportPortal)
- [ ] Dashboard: pass rate trend, flaky rate, top flaky tests, MTTR, coverage, execution time (§7.7)
- [ ] Failure auto-classification engine (decision tree §6.1 implement code)
- [ ] Flaky detection: track pass rate trên 30 run gần nhất, auto-quarantine khi < 90%
- [ ] `docs/flaky_kb.md` structure + auto-update từ RCA
- [ ] `docs/rca/` archive với template
- [ ] Self-healing locator: AI suggest top-3 alternative locator + open PR (KHÔNG auto-merge — spec §7.8)
- [ ] Failure metadata schema (TypeScript interface §6.3) + emit từ test run

### Plan checklist (cần fill trong plan file)
- Dashboard tool: Grafana+InfluxDB / ReportPortal / custom?
- Self-healing: dùng LLM API nào? (cost per suggestion?)
- KB storage: markdown file / DB / vector store?
- Auto-quarantine threshold: pass rate < 90% trên N run nào?
- Confidence score 0.9 tính thế nào — heuristic hay ML?

### Status updates
_(điền khi triển khai)_

---

## M6 — Optimization & Scale

**Map vào:** spec §11 Phase 6 (Week 17+), §8
**Status:** ⬜ Not started
**Plan file:** _chưa tạo — sẽ ở `docs/plans/M6-optimization.md`_
**Depends on:** M5 done

### Goal
Đạt target KPI §8 + mở rộng coverage.

### Done criteria (sign-off)
> Tất cả KPI §8.1-8.3 đạt target trong **2 tuần liên tục**:
> - Genuine pass rate > 95%
> - Flaky rate < 3%
> - False positive < 1%
> - Critical flow coverage 100%
> - MTTD < 30 min, MTTF P0 < 4h
> - Pipeline PR < 10 min, regression < 30 min

### Deliverables
- [ ] Performance test integration (Appium perfData + assertion contract perf section)
- [ ] Visual regression cho critical screen (Applitools/Percy/resemblejs)
- [ ] Cross-device matrix (top 5 device popularity)
- [ ] Contract testing với backend (Pact)
- [ ] Test analytics: trend prediction, regression risk score
- [ ] Maintenance cost tracker (hours fix flaky / sprint)
- [ ] ROI report: manual hours saved vs maintain hours

### Plan checklist (cần fill trong plan file)
- Visual tool: Applitools / Percy / resemblejs (free)?
- Pact provider verification: ai own backend integration?
- Device matrix list: 5 device cụ thể nào?
- Performance baseline: lấy từ đâu (current prod metric)?

### Status updates
_(điền khi triển khai)_

---

## Debt log

> Track technical debt được chấp nhận tạm thời + milestone phải trả nợ.
> **Rule:** debt chỉ đóng (status 🟢) khi milestone "Repay in" mark 🟢, kèm verify code không còn vi phạm spec.

| ID | Debt | Spec violation | Acquired in | Repay in | Status | Verification when repaid |
|----|------|----------------|-------------|----------|--------|--------------------------|
| D1 | Single-layer assertion (chỉ UI) trong smoke login test | §1.3 "Validation = Multi-layer", §6 Decision Matrix | M1 | M2 | 🟢 Repaid 2026-04-27 | `tests/smoke/login.spec.ts` chạy qua `AssertionRunner` + `AC_LOGIN_001.yaml` (3 UI + 2 Negative checks). API-fail simulation verified bằng `tests/integration/contract-execution.spec.ts` "MSW returns 500" → verdict FAIL, `layer: API`, routeTo: 1 ✓ |
| D2 | Hardcoded credentials trong `.env.local` cho smoke test | §4.5 "NEVER hardcode credentials", §4.2 isolation | M1 | M3 | 🟢 Repaid 2026-04-28 | `.env.local` không còn `TEST_USERNAME`/`TEST_PASSWORD` (deprecated keys giữ trong `src/config/index.ts` schema cho transition only); smoke spec đọc `globalThis.testAccount` set bởi global hook (`tests/_hooks/global.ts`) lease account từ AccountPool ở `beforeEach`. Grep clean. |
| D3 | `AC_LOGIN_001.yaml` không có `api_layer` block (Sauce Demo offline) | §5.2 multi-layer, §1.3 "Validation = Multi-layer" | M2 | M3 | 🟢 Repaid 2026-04-28 (path B) | `src/contracts/AC_API_DEMO_001.yaml` chạy real public HTTP (httpbin.org `/json`) end-to-end qua `tests/api/api-demo.spec.ts` — verdict PASS với 3 results. Force-fail schema mismatch (Zod `author: number`) trong `tests/integration/api-contract-real.spec.ts` → verdict FAIL `layer: API`, routeTo: 1, assignTo: dev_team. AC_LOGIN_001 vẫn không có api_layer (Sauce Demo offline) — debt đóng theo "API capability proven", không phải "login flow có API". |
| D4 | `StateChecker.adb_shell` backend chỉ work với debuggable APK; release APK sẽ block run-as | §5.2 state_layer, §3 step 4 production-readiness | M2 | M3 (real app expose debug API) hoặc M4 (BrowserStack run-as flag) | 🟡 Partial repay 2026-04-28 — code-level done, real-device verify carry-over M4 | `src/utils/assertion/checkers/mobileExecuteScriptStateCheckerDeps.ts` triển khai backend qua Appium `mobile: shell`; 6 unit tests cover (lease/{stdout} shape/cat skip/null/NotImplementedError/package injection guard). XML parser chia sẻ với adb backend qua `sharedPrefsParser.ts`. ⚠ **Real-device verify chưa hoàn thành**: Sauce Demo prod APK release-signed (`aapt dump badging` không có `application-debuggable` line) → carry-over M4 build minimal debuggable test APK. |

## Decisions log

Ghi lại các quyết định technical quan trọng và lý do (giúp future Claude hiểu rationale, tránh re-litigate):

| Date | Decision | Lý do | Liên quan milestone |
|------|----------|-------|---------------------|
| 2026-04-27 | M1 platform = Android local only, iOS defer M4 | User OS = Windows 11, không chạy iOS Appium local | M1, M4 |
| 2026-04-27 | M1 app = Sauce Labs Demo App (.apk public) | Clean reference để validate framework trước khi đụng app team | M1 |
| 2026-04-27 | M1 test runner = Mocha + Chai | WDIO default, ecosystem rộng nhất, không cần BDD overhead | M1 |
| 2026-04-27 | Node 20 LTS | WDIO 8 yêu cầu ≥18, 20 stable nhất 2026 | M1 |
| 2026-04-27 | Accept debt D1 + D2 — refactor M2 + M3 | M1 cần ship được smoke test, hạ tầng multi-layer & factory chưa có | M1, M2, M3 |
| 2026-04-27 | Pin `appium-uiautomator2-driver@3.7.0` (không dùng latest 4.x) | Driver 4.x yêu cầu Appium 3 RC; Appium 2.19 chỉ tương thích 3.x | M1 (constraint cho mọi M kế tiếp khi upgrade) |
| 2026-04-27 | Add `appWaitActivity: '*'` + `appWaitDuration: 30000` ở capabilities | Sauce Demo splash transition nhanh, Appium auto-detect activity miss → session create fail | M1 |
| 2026-04-27 | `waitForClickable` compose từ `isDisplayed && isEnabled` (không dùng `el.isClickable()`) | UiAutomator2 driver không support `isClickable` → "Method not supported in mobile native environment" | M1 (pattern cho mọi wait helper M2+) |
| 2026-04-27 | Setup Android SDK qua **cmdline-tools standalone** (không cần Android Studio GUI) | Phù hợp CLI-only workflow, lighter footprint, runbook đơn giản hơn cho CI sau này | M1, M4 (CI image) |
| 2026-04-27 | M2 schema lib = **Zod** | Type inference qua `z.infer<>`, đã trong CLAUDE.md stack, validate cả contract YAML lẫn API response | M2 |
| 2026-04-27 | M2 StateChecker = `mobile:executeScript` primary + `adb shell run-as` fallback | Sauce Demo không có debug API; abstraction giữ contract không đổi khi M3 swap real app | M2, M3 |
| 2026-04-27 | M2 severity action = theo §5.3 nguyên văn + thêm `securityImpact:true` flag cho `critical (security)` | Tuân thủ spec; security failure cần priority cao hơn ở M5 routing | M2, M5 |
| 2026-04-27 | M2 negative log capture = post-test `getLogs('logcat')` (không streaming) | Đơn giản cho M2; streaming defer M5 observability | M2, M5 |
| 2026-04-27 | M2 API layer = test code (Node) tự call API verify backend, KHÔNG proxy/HAR sniff | Đơn giản, không cần proxy infra; HAR-based defer M5 nếu cần | M2, M5 |
| 2026-04-27 | M2 AC_LOGIN_001 = UI + State + Negative (không API) — acquire **D3** | Sauce Demo offline; framework's API capability verified qua AC_API_DEMO + MSW | M2, M3 (repay D3) |
| 2026-04-27 | M2 soft assertion = tự build trong AssertionRunner (không Chai soft) | Chai soft chỉ work trong `it()`; runner cần work cả unit test scope | M2 |
| 2026-04-27 | M2 contract location = `src/contracts/AC_<TC_ID>.yaml` | Theo spec §10.3 — global registry, reusable across suites | M2+ |
| 2026-04-27 | M2 expression = **structured discriminated union** (Zod-validated, không eval) | An toàn (no injection), type-checked, AI ở M5 generate dễ; verbose hơn ~30% chấp nhận | M2, M5 |
| 2026-04-27 | M2 API mock = **MSW (Node-side)** | Không cần process riêng; WireMock save M4 cross-shard CI | M2, M4 |
| 2026-04-27 | M2 mọi checker dùng **dependency injection adapter pattern** (UiCheckerDeps, ApiCheckerDeps, …) | Tách checker logic khỏi WDIO/Axios/adb runtime → unit test 31 cases chạy 27ms total (no Appium boot) | M2+ (pattern cho mọi checker mới) |
| 2026-04-27 | M2 unit test config phải có `'node-option': ['no-experimental-strip-types']` trong `.mocharc.unit.cjs` | Node 22+ default tries built-in TS strip → conflict với ts-node + parameter properties (`constructor(private foo: T)`) — ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | M2+ (đến khi migrate sang tsx hoặc ts-node esm) |
| 2026-04-27 | FailureMetadata routing M2 = heuristic theo layer (UI/STATE→4, API→1, NEGATIVE→2, PERF→7) | M2 emit-only; M5 sẽ augment qua history (reproducible? flaky? env?). Interface đã đủ chỗ chứa data thêm | M2, M5 |
| 2026-04-27 | Spec file phải gọi explicit `waitForVisible(<readiness anchor>)` sau action chính trước khi `runner.runContractById()` | AssertionRunner không tự wait — UI checks dùng `find()` đơn lẻ, race với app render. M1 có wait này, refactor sang contract pattern bị mất → false-fail. Pattern bắt buộc cho mọi spec từ M3+. | M2+ |
| 2026-04-27 | Negative `log_pattern_absent` pattern phải scope theo app/process — KHÔNG dùng generic exception name | Pattern `NullPointerException` bắt cả NPE từ system services (TapAndPay, dlpn) → false-fail. Pattern chuẩn: `Process:\s*com\.<package>` (Android crash dump signature) hoặc `<TAG>.*<exception>`. M5 sẽ codify thành KB rule. | M2, M3 (mọi contract mới), M5 (KB rule) |
| 2026-04-27 | M3 account pool = in-memory + file lock (`proper-lockfile`) | M3 chạy local + M4 single-runner cùng filesystem; HTTP service overengineering. Refactor multi-host nếu M5 cần | M3, M5 |
| 2026-04-27 | M3 pool size = 6 Sauce Demo built-in users với role tag | Public docs sẵn 6 user, password đồng nhất; match `maxInstances` parallel | M3, M4 |
| 2026-04-27 | M3 cleanup = lease/release only, no real data cleanup | Sauce Demo không có create/delete API; state app handled bằng `noReset:false` | M3 |
| 2026-04-27 | M3 env matrix = `local` + `staging` skeleton (BS env-driven, không wire device farm M3) | `prod` defer M6 (cần real prod app + risk control); `staging` skeleton đủ chứng minh env loader pattern | M3, M4 |
| 2026-04-27 | M3 network sim = Appium `mobile:networkSpeed` (Android emulator built-in) | Free, không cần proxy infra; advanced sim defer M5 | M3, M5 |
| 2026-04-27 | D3 repay path = **B** (AC_API_DEMO_001 với public API thật, không swap real app) | Sauce Demo offline; coordinate app team sẽ delay M3. Path B chứng minh API capability end-to-end (không qua MSW); AC_LOGIN_001 giữ no api_layer | M3 |
| 2026-04-27 | D4 repay = `mobile:executeScript` backend + integration test với debuggable APK (test APK custom nếu Sauce Demo không debuggable) | Đóng D4 đúng tinh thần "release APK vẫn check state". `mobile:executeScript` work cả debuggable + release nếu plugin enabled | M3 |
| 2026-04-27 | M3 lock library = `proper-lockfile` | Well-maintained, retry built-in, lock dir auto-cleanup; custom O_EXCL phải tự handle stale lock | M3 |
| 2026-04-27 | M3 acceptance compress 50x → 20x smoke; 50x defer M6 KPI verification | Smoke ~30s × 50 = 25min/verify quá nặng cho mỗi PR M3; 50x là KPI scale check thuộc M6 | M3, M6 |
| 2026-04-28 | M3 AccountPool `lease()` retry-with-poll thay vì throw-immediately khi pool full | Acceptance §2.4 yêu cầu "process 2 BLOCK đến khi process 1 release". Initial impl throw immediately → integration concurrency test fail. Retry loop 200ms poll trong `leaseAcquireTimeoutMs` budget; deadline dùng wall-clock (`Date.now()`) cho frozen-clock unit test compatibility. | M3 |
| 2026-04-28 | `src/utils/sleep.ts` centralize ESLint exception cho `setTimeout` | Blanket ban `no-restricted-syntax` áp dụng cho cả prod code (retry/poll cần sleep). Helper với 1 `eslint-disable-next-line` thay vì rải rác → spirit của rule (no-pause-in-tests) preserved, chỉ cần code review file này. | M3+ |
| 2026-04-28 | M3 D4 close ở mức **unit-mock + code-level**, real-device verify carry-over M4 | Sauce Demo prod APK release-signed → `run-as` block + APK không debuggable. Build debuggable test APK hoặc coordinate app team expose debug build là M4 work. Code-level proof qua `tests/unit/state-checker-mobile.spec.ts` đủ chứng minh backend logic. | M3, M4 |
| 2026-04-28 | M4 repo location = **`github.com/santete/appium-automation-testing`**, default branch `main` | Q1 sign-off Phuc DN; personal namespace, không qua FPT org → đơn giản access + free GH Actions tier (private repo 2000 min/month). | M4 |
| 2026-04-28 | M4 **KHÔNG wire device farm** (BrowserStack/Sauce Labs) — config-driven stub `wdio.bs.ts` + `wdio.sauce.ts` skeleton cho M5+ swap | Q2 sign-off Phuc DN — "chưa cần device farm, ưu tiên real device dev, config-driven nếu cần thiết". M4 focus CI pipeline reliability + quarantine + Allure publish; device farm scope creep. Stub preserves swap path khi M5 cần. | M4, M5 |
| 2026-04-28 | M4 **smoke E2E giữ local-dev**, PR template checkbox gate (honor system) thay vì auto CI block | Hệ quả Q2 — không wire device farm thì CI runner Linux không chạy được Appium + Android emulator (cần self-hosted runner = scope creep). Tradeoff explicit: faster CI (< 5 phút non-device tier) vs honor-system smoke verify; reviewer enforce qua PR template. M5+ wire device farm hoặc self-hosted runner → auto. | M4, M5 |
| 2026-04-28 | M4 **không sharding** — single CI job, suite non-device < 1 phút | Hệ quả Q2 + sub-suites hiện gọn (unit 54 + integration 8 + api 1 + typecheck + lint < 1 phút). Sharding overengineering; activate khi suite > 5 phút (M5/M6 nếu add E2E vào CI). | M4 |
| 2026-04-28 | M4 quarantine deadline = **2 tuần default + 1 tuần grace** (extend tối đa 1 lần qua PR review), past-deadline → CI fail | Q5 sign-off — force fix trước khi quarantine quên; grace cho real blocker. Mocha custom hook đọc `docs/quarantine.yaml` + Zod schema, deadline-aware skip/throw. | M4, M5 |
| 2026-04-28 | M4 D4 APK = **minimal Kotlin app** trong `apps/test-debuggable-src/`, Gradle wrapper checked in, build local | Q6 sign-off + Q2 device farm defer → APK build + verify đều local. Phuc verify thủ công 1 lần đóng D4. M5+ wire CI build APK + device farm test. | M4, M5 |
| 2026-04-28 | M4 quarantine mechanism = **custom Mocha hook + YAML** (không dùng `mocha-grep`) | Single source-of-truth (`docs/quarantine.yaml`), deadline enforcement automatic; `mocha-grep` không deadline-aware. Hook chạy trước global lease (skip throw before lease) tránh leak account. | M4 |
| 2026-04-28 | M4 Allure publish = **GH Pages**, per-run subfolder, **30 ngày rolling cleanup** | Q9 sign-off — zero cost + native với GH Actions (`peaceiris/actions-gh-pages`); URL stable `<user>.github.io/<repo>/<run-id>/`. Allure TestOps paid → defer M5. | M4, M5 |
| 2026-04-28 | M4 branch protection = **main only**, required check `ci / verify` + 1 review, force-push blocked | Q10 sign-off — single-eng project chưa cần `develop` flow. Override path documented (admin force-merge) cho emergency. | M4 |
| 2026-04-28 | **Bump Node 20 LTS → 22 LTS** (CI workflows + `package.json` engines) — supersedes M1 decision row 4 | CI run đầu tiên fail vì `mocha --no-experimental-strip-types` không tồn tại trên Node 20 (M2 decision row 22 thêm flag để fix Node 22 default TS-strip; flag chỉ valid trên Node 22+). Dev machine đã Node 22.18.0 → align CI khớp. Node 22 = Active LTS từ 10/2024, không downgrade-only. | M4 (CI fix); M5+ giữ Node 22 |
| 2026-04-28 | **M4 plan revision v1.0 → v1.1** — defer Task 6 (Allure host), Task 7 (Slack notify), Task 11 (pipeline duration) sang M5; supersedes Decision 8 (GH Pages) + Decision 9 (Slack 2 channels) | (a) GH Pages bị Enterprise org block khi Phuc check; Vercel alternative không justify cho solo dev. (b) "kênh nhận thông tin cảnh báo này nọ setup sau, dashboard chưa share link được thì xem local, tập trung xử lý cho hoàn thiện sản phẩm có thể chạy solo ở local". (c) Pipeline duration tracker chỉ M5 dashboard mới consume. M4 final scope = framework chạy được solo local (CI auto + smoke gate manual + D4 verified). | M4 (drop), M5 (revisit khi có team / dashboard tool) |
| 2026-04-28 | **M4 branch protection drop "1 review required"** — supersedes Decision 7 v1.0 | Solo dev không có reviewer khác → "1 review required" sẽ block forever khi anh tự PR. Giữ required check `ci / verify` + force-push blocked. M5+ add review requirement khi có team. | M4 (revised), M5 |

---

## Cập nhật roadmap

- Khi start milestone: chuyển status ⬜ → 📝, tạo plan file từ template, fill xong → 🔵, sign-off → 🟡.
- Khi xong: verify done criteria, update Decisions log nếu có quyết định mới, đóng status → 🟢.
- Khi blocked: 🔴 + ghi blocker cụ thể vào bảng tổng quan.
- Mỗi tuần update "Status updates" trong milestone đang chạy (1-2 dòng).
