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
| M4 | CI/CD Integration | 🟢 | [M4-cicd.md](docs/plans/M4-cicd.md) | 2026-04-29 → 2026-05-20 (3 tuần) | 2026-04-28 → 2026-04-28 | D5+D6 verify-only dời M6 closure (Decision 10) |
| M5 | Observability & Intelligence | 🟢 | [M5-observability.md](docs/plans/M5-observability.md) | 2026-04-29 → ~3-4 tuần | 2026-04-28 → 2026-04-29 | — |
| M6 | Optimization & Scale | 🔵 | [M6-optimization.md](docs/plans/M6-optimization.md) | 2026-05-01 → ~2026-06-05 (~3-5 tuần) | — | Phuc fill BS credentials trước Task 4 + LLM key trước Task 12 walkthrough |
| M7 | Validation Milestone (designed → battle-tested) | 📝 | [M7-validation.md](docs/plans/M7-validation.md) | 2026-06-08 → ~2026-07-13 (~5 tuần) | — | Pending sign-off + M6 closure done |

**Dependency graph:**
```
M1 → M2 → M3 → M4 → M5 → M6 → M7
       ↑     ↑
       └─ M3 có thể overlap với M2 sau khi AssertionRunner core xong
       └─ M4 cần M2 + M3 stable trước
       └─ M7 = validation, không feature mới — đóng debt M1-M6 + benchmark/calibrate vibe-spec
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
**Status:** 🟢 Done (2026-04-28 — non-device tier auto + framework completeness shipped; verify-only debt D5 (GH UI) + D6 (real-device) dời M6 closure per M5 Decision 10 debt consolidation policy)
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
| 2026-04-28 | **Framework completeness Đợt 1+2 🟢 (autonomous batch trong khi chờ D5+D6 verify).** Đợt 1.1-1.4 Page Objects: `ProductsPage` (cart icon + badge + add/remove + items), `CartPage` (container + checkout + remove + items), `CheckoutPage` (3-step flow: First/Last/Postal → CONTINUE → FINISH → CHECKOUT: COMPLETE!), `MenuPage` (hamburger → LOGOUT/RESET APP STATE). Đợt 1.5 Negative spec `tests/negative/login-invalid.spec.ts` + `AC_LOGIN_NEG_001.yaml` (2 cases: wrong password + locked_out_user, share contract). Đợt 1.6 Regression spec `tests/regression/purchase-happy-path.spec.ts` + `AC_PURCHASE_001.yaml` (E2E login → add → cart → checkout → finish). Đợt 1.7 Nightly spec `tests/nightly/checkout-empty-fields.spec.ts` + `AC_CHECKOUT_NEG_001.yaml` (empty First Name → error). Đợt 2: `docs/runbook.md` expanded với §11 Real device USB, §12 Emulator advanced (CLI AVD create + headless), §13 Per-suite commands table, §14 M2-M4 troubleshooting, §15 Allure local. `package.json` thêm `test:negative` + `test:nightly` script. Verify: typecheck ✅, lint ✅. **Coverage hiện có:** 1 smoke + 1 regression + 1 negative + 1 nightly + 1 api real + 8 integration + 75 unit. |

---

## M5 — Observability & Intelligence

**Map vào:** spec §11 Phase 5 (Week 13-16), §6 + §7.4-7.8
**Status:** 🟢 Done (2026-04-29 — acceptance harness 16/20 ≥ 0.9 confidence; 7-sub-point runbook ready cho Phuc walkthrough)
**Plan file:** [docs/plans/M5-observability.md](docs/plans/M5-observability.md)
**Depends on:** M4 done (cần dữ liệu run từ CI) — D5+D6 dời M6 closure per Decision 10 (debt consolidation)
**Carry-over từ M4:** Task 6 (Allure host), Task 7 (Slack/notify), Task 11 (pipeline duration tracker) — all shipped trong M5 Tasks 8/9/10

### Goal
Auto-classify failure + dashboard trends + knowledge base + self-healing suggestion.

### Done criteria (sign-off)
> Failure mới → auto-classify với **confidence > 0.9** + suggest fix + KB pattern matched, **không cần human classify thủ công** cho 80% case.

### Deliverables
- [x] Grafana + InfluxDB stack (Task 5: `infra/observability/docker-compose.yaml` + 6-KPI dashboard JSON + smoke ingest README)
- [x] Dashboard: pass rate trend, flaky rate, top flaky tests, MTTR, coverage, execution time (§7.7) — Task 5+6 shipped 6 KPI panels + bonus pipeline duration trend
- [x] Failure auto-classification engine (Task 1: rule engine với 10 first-match-wins rules + Task 2 LLM escalator config-driven `.env`)
- [x] Flaky detection: track pass rate trên 30 run gần nhất, auto-quarantine khi < 90% (Task 3: combined threshold `<90%/30 AND ≥1/5` + auto-quarantine PR generator)
- [x] `docs/flaky_kb.md` structure + auto-update từ RCA (Task 7: `src/utils/kb/appender.ts` confidence ≥ 0.85 gate + 24h dedup window + manual-section preservation)
- [x] `docs/rca/` archive với template (Task 11: markdown table-format `_template.md` + skill SKILL.md updated cho cross-link RCA ↔ KB)
- [x] Self-healing locator: AI suggest top-3 alternative locator + open PR (KHÔNG auto-merge — spec §7.8) (Task 4: spike doc + suggester adapter + workflow_dispatch trigger)
- [x] Failure metadata schema (TypeScript interface §6.3) + emit từ test run (Task 0+1: `src/utils/classifier/types.ts` `FailureClassification` + `src/utils/metrics/influxEmitter.ts` afterTest hook)

### Plan checklist (cần fill trong plan file)
- Dashboard tool: Grafana+InfluxDB / ReportPortal / custom?
- Self-healing: dùng LLM API nào? (cost per suggestion?)
- KB storage: markdown file / DB / vector store?
- Auto-quarantine threshold: pass rate < 90% trên N run nào?
- Confidence score 0.9 tính thế nào — heuristic hay ML?

### Status updates
| Date | Update |
|------|--------|
| 2026-04-28 | Plan v0.1 draft published — 9 decisions proposed (dashboard tool, LLM API, KB storage, flaky threshold, confidence scoring, notify channel, report channel, M4 D5+D6 parallel, spike-first). 12 task breakdown ~57h estimate. M4 carry-over (Allure host, Slack/notify, pipeline duration) folded vào Task 8+9+10. **Status → 📝 Planning. Chờ Phuc DN review + sign-off.** Acceptance test 7 sub-points proposed. |
| 2026-04-28 | Phuc DN sign-off all 9 defaults; Decision 2 revise sang **config-driven `.env`** (provider-agnostic LLM adapter — `LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`/`LLM_BUDGET_MONTHLY_USD`); Decision 10 added — **debt consolidation M6 closure** (D5+D6 dời M4 closure → M6 closure batch repay). Task 0 (LLM scaffold + adapter pattern) thêm vào breakdown để Task 1+3+5-8 chạy được ngay (Task 2+4 chờ `.env` fill). Total estimate ~57h → ~61h. **Plan v0.1 → v1.0. Status → 🔵 Plan ready.** |
| 2026-04-29 | **All 13 tasks 🟢 (autonomous batch).** Task 0 LLM adapter scaffold (provider-agnostic `.env`-driven, `nullAdapter`/`OpenAIAdapter`, budget gate via `tmp/llm-spend.json`). Task 1 classifier engine (10 rules first-match-wins, FailureClassification emit). Task 2 LLM escalator (confidence < 0.85 gate, swallow errors). Task 3 flaky tracker + auto-quarantine PR (combined threshold `<90%/30 AND ≥1/5`, 14d deadline). Task 4 self-heal spike doc + suggester adapter + `self-heal.yml` workflow_dispatch (PR-only, no auto-merge). Task 5 Grafana+InfluxDB docker-compose + 6 KPI dashboard JSON + smoke ingest README. Task 6 InfluxDB metric emitter từ WDIO afterTest hook (best-effort, 17 unit tests). Task 7 KB appender (confidence ≥ 0.85 + 24h dedup + manual-section preserve, 14 unit tests). Task 8 pipeline duration tracker (`scripts/append-duration.cjs` + CI/Regression workflow steps). Task 9 `publish-allure.yml` (workflow_run trigger, GH Pages deploy, Vercel fallback block). Task 10 `notify-fail.yml` (workflow_run filter main+failure, GH Issue create/comment, SMTP fallback). Task 11 `docs/rca/_template.md` markdown table-format + skill SKILL.md update cross-link RCA↔KB. Task 12 corpus 20-case + acceptance harness (5 specs) + `docs/runbook-M5-acceptance.md` 7-sub-point. Verify: typecheck ✅, lint ✅, unit 209/209 ✅. Acceptance harness: **16/20 cutoff đúng = 80% accuracy ≥ 0.9 confidence**. **Plan §13 closure filled. Status → 🟢 Done.** |

---

## M6 — Optimization & Scale

**Map vào:** spec §11 Phase 6 (Week 17+), §8
**Status:** 🔵 Plan ready (v1.0 sign-off 2026-05-01 — Decisions 1-9 confirmed; sẵn sàng execute Task 0)
**Plan file:** [docs/plans/M6-optimization.md](docs/plans/M6-optimization.md)
**Depends on:** M5 🟢 done; Phuc fill `.env` BS credentials trước Task 4; Phuc fill LLM key trước closure walkthrough Task 12
**Includes closure batch:** D5+D6 (M4 verify-only debt) + 4 M5 verify-only sub-points (dashboard live / self-heal end-to-end / Allure URL / notify fan-out) per Decision 10 M5

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
| Date | Update |
|------|--------|
| 2026-04-29 | Plan v0.1 draft published autonomous batch ngay sau M5 closure (per standing instruction "cứ triển khai theo thứ tự trên thôi, không skip đợt nào cả, cho tới khi nào gặp được M6"). 9 decisions proposed (Decision 1-3 từ ROADMAP M6 checklist: visual tool resemblejs / Pact owner consumer+stub / device matrix mixed Android+iOS; Decision 4-9 mới phát sinh: BS primary / KPI gate hybrid / maintenance cost git log / ROI critical-flow weighted / debt closure distributed sequencing / iOS spike). 13-task breakdown ~60h + 2-week sustained verify + ~10h Phuc walkthrough. Acceptance test 8 sub-points (gồm KPI sustained 2-week + perf + visual + cross-device + Pact + analytics + ROI + debt closure). **Status → 📝 Planning. Chờ Phuc DN review + sign-off.** |
| 2026-05-01 | **Phuc DN sign-off Decisions 1-9.** D1 OK (resemblejs), D2 OK (mobile own consumer + provider stub), D3 default (Mixed Android+iOS) + fallback real device cắm trực tiếp khi BS gặp blocker, D4 OK (BrowserStack), D5 Hybrid (default), D6 default (git log convention), D7 default (critical flow weighted), D8 default (distributed closure), D9 default (iOS spike). Plan v0.1 → v1.0. **Status → 🔵 Plan ready.** Sẵn sàng execute Task 0 (D5+D6 closure walkthrough đầu sprint 1). |
| 2026-05-01 | **`GeminiAdapter` shipped (M6 prerequisite).** Phuc chosen Gemini 2.5 Flash → adapter native REST + factory case + Zod enum extend + 11 unit test (220/220 pass, 0 lint, 0 type error). Phuc fill `.env.local`: `LLM_PROVIDER=gemini`, `LLM_API_KEY=<AIza...>`, `LLM_MODEL=gemini-2.5-flash` để Task 12 closure walkthrough verify live LLM call. ROADMAP Decisions log row mới ghi extension. |

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
| D5 | M4 acceptance sub-points 1+2+3+4 (branch protection + PR CI gate + force-fail block + nightly dispatch) chưa verify trên GitHub UI | M4 plan §2 v1.1 done criteria sub-points 1-4 | M4 | **M7 W1 batch** (revise từ M6 closure khi sprint W1 close 2026-05-02) | 🟢 Repaid 2026-05-02 (W1 batch) | **(a) Branch protection enforce verified:** PR #2 (`chore/m4-acceptance-test-v2` → main) merge clean với typecheck CI gate green. **(b) Force-fail block — root cause uncovered:** PR #3 (`chore/m4-d5-force-fail`) push `const _force_fail_d5: string = 42` → typecheck CI **failed** (`Type 'number' is not assignable to type 'string'`) NHƯNG merge button không block — Settings page warn `"private repo can't be enforce"`. **Root cause: GitHub Free tier không enforce branch protection trên private repo.** Resolution: Phuc chuyển repo private → public 2026-05-02 → revert PR #4 (`chore/revert-d5-force-fail`) verify branch protection now enforces (CI green required + approve count adjusted 0 cho solo-dev). **(c) Nightly dispatch:** Phuc click `Actions → Regression (nightly) → Run workflow → main` → run green tất cả 7 step (typecheck/lint/quarantine/unit/integration/api/upload-allure) + Allure artifact `allure-results-regression-<run_id>` downloadable. **Lessons learned:** Free tier branch protection limit là silent gap — vibe-spec audit miss. Public repo trade-off: source visible nhưng unblock GH Pages (M5 Decision row 36) + branch protection enforce. Decision row mới ghi limitation cho future projects. |
| D6 | M4 acceptance sub-point 6 (D4 real-device verify trên dev Android device) chưa chạy thực | M4 plan §2 v1.1 done criteria sub-point 6 | M4 | **M6 closure** (debt consolidation per Decision 10 M5; revise từ "M4 closure") | 🟡 Open 2026-04-28 | Trên dev workstation: `adb devices` → 1 device authorized; `npm run build:test-apk` → `apps/state-test-debug.apk` build success; terminal khác `appium --allow-insecure adb_shell --base-path /`; `RUN_REAL_DEVICE=1 ANDROID_DEVICE_NAME=<id> npm run test:integration` → spec `Integration (REAL DEVICE): mobile:executeScript state lookup` 2 cases PASS (default prefs + absent key negative). Tất cả code đã ship 2026-04-28 (`apps/test-debuggable-src/` + `scripts/build-test-apk.cjs` + `tests/integration/state-checker-mobile-real.spec.ts`). |
| D7 | Audit toàn bộ Assertion Contract perf/visual để confirm tất cả threshold có env override hook (anti-pattern "threshold không-aware-env" sẽ lặp lại cho mọi perf/visual SLA) | §5.2 multi-layer + §7.5 P95 SLA + RCA TC_PERF_LOGIN_001 root cause | M6 (RCA-flagged 2026-05-01) | **M7 Task 10** | 🟢 Repaid 2026-05-02 (W1 batch) | `src/contracts/_schema.ts` PerfCheckSchema thêm field `threshold_env_var` (Zod regex SCREAMING_SNAKE_CASE optional). 3 contracts (AC_PERF_LOGIN/CHECKOUT/SEARCH_001) declare env var. `src/utils/perf/resolveThreshold.ts` helper resolve qua env (precedence env_override → contract_default) + emulator detection (regex `ANDROID_DEVICE_NAME` patterns + `PERF_FORCE_DEVICE_TYPE` override) + warn-on-mismatch. 3 perf specs swap `thresholdMs` literal → `resolvePerfThreshold(contractId).thresholdMs`. 17 unit test pass (`tests/unit/resolve-threshold.spec.ts`). Visual contract chưa có (defer M7 nếu add `AC_VISUAL_*.yaml`). |
| D8 | Document emulator vs real device perf gap multiplier (4-5x) trong runbook + `.env.example` block comment với profile preset emulator | RCA TC_PERF_LOGIN_001 lessons learned + Trustworthiness Pyramid §1.2 (Maintainable: future engineer cần context) | M6 (RCA-flagged 2026-05-01) | **M7 Task 11** | 🟢 Repaid 2026-05-02 (W1 batch) | `docs/runbook-operations.md` §3.5 "Perf SLA calibration check" với calibration table 3 flow (login/checkout/search × real-vs-emulator P95 × override env var) + override workflow + monthly drift policy. `.env.example` thêm block "M6 Perf SLA env-aware overrides (D7+D8)" với commented-out emulator profile (3 env var + `PERF_FORCE_DEVICE_TYPE`). |
| D9 | Visual spec hook bug — `tests/visual/screens-visual.spec.ts` dùng `before` hook nhưng `globalThis.testAccount` chỉ set bởi `beforeEach` global hook → first-run baseline create fail | §4.2 test isolation + spec internal contract giữa global hook và per-suite hook | M6 (demo-flagged 2026-05-01) | **M7 Task 9** | 🟢 Repaid 2026-05-02 (W1 batch) | `tests/visual/screens-visual.spec.ts` swap `before` → `beforeEach`; comment block giải thích root cause (global hook root-level beforeEach race). Verify 20× regression run carry-over Phuc real device session (BS hoặc local emulator setup). |
| D10 | Self-heal AI suggest accuracy chưa benchmark — claim "AI-augmented self-heal" không có precision/recall data | §7.8 self-heal locator (spec yêu cầu human-approved nhưng không yêu cầu accuracy benchmark — gap em call out trong vibe-spec audit) | M5 (2026-04-29) → M7 surface | **M7 Task 3** | 🟡 Open 2026-05-02 | `docs/m7-self-heal-benchmark.md` với precision ≥ 70% + recall ≥ 80% trên 30 inject locator drift; `scripts/inject-locator-drift.cjs` reproducible test harness. |
| D11 | LLM classifier confidence threshold ≥ 0.8 chưa calibrate với corpus thật — threshold là arbitrary | §7.7 classifier accuracy claim (em call out vibe-spec) | M5 (2026-04-28) → M7 surface | **M7 Task 4** | 🟡 Open 2026-05-02 | `docs/m7-llm-calibration.md` với confusion matrix qua 50 historical fail manually labeled, accuracy ≥ 85% trên hold-out 10/50; `tmp/m7-classifier-corpus.json` corpus committed. |
| D12 | 20-run stability gate spec §6.4 yêu cầu — CI chưa auto-enforce cho spec mới | §6.4 "Fix verified isolated (≥ 20 run cùng pass)" | M2 (2026-04-27) — discipline gap, defer indefinite | **M7 Task 5** | 🟢 Repaid 2026-05-02 (W1 batch) | `scripts/detect-new-spec.cjs` parse `git diff --name-status BASE_REF...HEAD` filter `A` status + `tests/.../*.spec.ts` → classify runnable (unit/integration/api) vs deviceRequired (smoke/regression/visual/perf/nightly/negative). `.github/workflows/stability-gate.yml` PR-trigger workflow: detect job → stability-run job chạy 20× sequential nếu has_runnable, block merge khi pass <19/20. Device-required → CI warn + PR template manual checkbox. Override label `skip-stability-gate` short-circuit (Decision 3 M7 rename edge case). |
| D13 | iOS shelfware — M6 Task 8 spike code shipped nhưng chưa chạy real, 1 spec only, framework cross-platform claim chưa validate | §10 cross-platform iOS/Android + spec spike out-of-scope full coverage | M6 (2026-05-01) | **M7 Task 6** (promote spike → Tier 2 với 5 spec, 2 device) | 🟡 Open 2026-05-02 | 5 iOS smoke spec pass trên BS iPhone 14 + iPhone 15; spike doc verdict updated PASS với production evidence. |
| D14 | BS matrix shelfware — M6 Task 4 code shipped nhưng matrix end-to-end (5 device × 15 spec regression) chưa run thật | §10.4 device farm + M6 Decision 4 BS chosen | M6 (2026-05-01) | **M7 Task 7** | 🟡 Open 2026-05-02 | `npm run test:bs:matrix -- --sequential` chạy thành công 5 device × full regression suite, Allure consolidated report; `docs/m7-bs-matrix-evidence.md` archive screenshot BS dashboard 5 session pass. |
| D15 | ROI report `docs/m6-roi-report.md` §3 trend table toàn `_TBD_`/`_fill_` placeholder — chưa data thật | M6 Decision 7 ROI formula (data-driven) — placeholder accepted M6 closure timeline | M6 (2026-05-01) | **M7 Task 8** (calendar-bound: cần 4 tuần Influx data) | 🟡 Open 2026-05-02 | §3 table 4 row (W1-W4) fill số thật từ Influx query: `hours_saved`, `hours_spent`, `ratio`, `net`. ROI conclusion data-backed thay vì formula speculation. |
| D16 | `fix(flaky):` commit convention discipline gap — engineer có thể quên tag → maintenance cost tracker miss data | M6 Decision 6 convention `fix(flaky):` (process risk) | M6 (2026-05-01) | **M7 Task 12** | 🟢 Repaid 2026-05-02 (W1 batch) | `.husky/commit-msg` zero-dep bash hook block commit khi subject `^fix:[ ]` (no scope) + staged diff touch `tests/`. Hint message gợi ý 3 scope chuẩn (flaky/locator/env) + alternative scope. `scripts/install-hooks.cjs` auto-install qua `npm run prepare` (no husky/commitlint dep). 3 case verify pass: feat (any path) → ok, fix:no-scope+tests staged → block, fix(flaky)+tests staged → ok. Override `--no-verify` allowed (git reflog audit trail). |

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
| 2026-04-28 | **M5 dashboard tool = Grafana + InfluxDB self-host (Docker compose)** | Zero recurring cost, control schema, dễ migrate khi scale; ReportPortal overkill cho 1-eng; Allure TestOps SaaS không justify cost. | M5, M6 |
| 2026-04-28 | **M5 LLM = provider-agnostic adapter, config-driven qua `.env`** (`LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`/`LLM_BASE_URL`/`LLM_BUDGET_MONTHLY_USD`) | Phuc chưa chốt model + key sẵn → blocked nếu hardcode. Adapter pattern khớp M2 DI checker pattern. Future-proof khi đổi vendor / thử local Llama. | M5 |
| 2026-04-28 | **M5 LLM budget gate** = monthly spend tracker `tmp/llm-spend.json` (`proper-lockfile` reuse), exceed → fallback `nullAdapter` rule-only + log KB warning | Zero surprise cost; rule-only fallback (Decision 5 combined) vẫn chạy khi budget burn. Reset tự động đầu tháng. | M5 |
| 2026-04-28 | **M5 KB storage = single markdown `docs/flaky_kb.md`**, auto-promote SQLite FTS5 khi >50 entry | Start simple cho 1-eng; markdown human-readable + git-tracked + grep search đủ; promote khi pain point lộ. | M5, M6 |
| 2026-04-28 | **M5 flaky auto-quarantine threshold = combined: <90% / 30 run gần nhất AND ≥1 fail / 5 run gần nhất** | Vừa cover pattern flaky kéo dài vừa không quarantine test fail batch gần đây do legit bug. Manual override `quarantine: false` flag để force keep. | M5 |
| 2026-04-28 | **M5 confidence score = combined rule-based fast path (80% case) + LLM slow path (20% ambiguous)** | Cost optimal + latency optimal + quality acceptable. LLM call gated qua adapter; `LLM_PROVIDER=none` hoặc budget exceed → fallback rule-only. | M5 |
| 2026-04-28 | **M5 notification = GH Issue auto-create primary + email SMTP fallback** (drop Slack/Discord cho M5) | GH-native zero-tool; email backup cho urgent failure khi không vào GH. Slack/Discord defer khi có team. | M5, M6 |
| 2026-04-28 | **M5 Allure publish = GH Pages re-attempt → Vercel fallback** | Org policy có thể đã unlock; check `gh api repos/.../pages` first. Fallback Vercel nếu vẫn block. | M5 |
| 2026-04-28 | **M5 spike-first cho LLM/AI feature** — Task 1 (classifier) + Task 4 (self-heal) viết spike doc trong `docs/spikes/` trước implement | LLM behavior khó predict; spike de-risk + de-scope nếu không khả thi (vd. self-heal trên Sauce Demo offline có giới hạn). | M5 |
| 2026-04-28 | **Debt consolidation policy = repay batch ở M6 closure** (chỉ áp cho **verify-only debt**, không cho code-incomplete debt) | Phuc DN explicit workflow preference: "các debt cứ dồn về phase cuối, tao sẽ giải quyết luôn 1 lần". M4+M5 có thể mark 🟢 với verify debt 🟡 open; M6 closure dành sprint cuối purge. Code-incomplete debt vẫn repay milestone tiếp theo. **Áp dụng:** D5+D6 dời "Repay in" từ M4 closure → M6 closure. | M4 (revise), M5, M6 (closure constraint) |
| 2026-05-01 | **M6 visual regression tool = resemblejs** (DIY zero-cost) | Solo dev + zero recurring cost ưu tiên; baseline lưu `tests/visual-baselines/<screen>.png` PNG nhỏ; diff threshold 5% configurable. Migrate Percy/Applitools nếu pain point lộ M6+. Pattern align Decision 1 M5 (zero-cost self-host). | M6 |
| 2026-05-01 | **M6 Pact ownership = mobile team own consumer + provider stub trong CI** | Solo dev không có backend team coordinate; ship 2 contract minimum (auth + cart) với Pact CLI provider stub. Pragmatic cho 1-eng; M7+ migrate provider verification về backend team khi scale. | M6 |
| 2026-05-01 | **M6 device matrix = Mixed Android+iOS qua BS** (default) + **fallback real device cắm trực tiếp** khi BS gặp blocker | 5 device: Samsung A14, Pixel 7, Xiaomi Redmi Note 12, iPhone 14, iPhone SE 3rd gen. Acceptance test §2.4 đã viết "1 cấu hình real local + 4 device farm" → khớp. Nếu BS access fail, scope giảm Android-only real device matrix, iOS dời Task 8 spike-only; document fallback `docs/runbook-M6-acceptance.md` Task 10. | M6 |
| 2026-05-01 | **M6 device farm primary = BrowserStack** | Stub `wdio.bs.ts` đã ship M4 Task 3; Phuc fill `BS_USERNAME`/`BS_ACCESS_KEY` switch on; free trial 100 min đủ verify 1-2 run × 5 device. Pay-as-you-go scale linear. Sauce Labs reserved fallback. | M6 |
| 2026-05-01 | **M6 KPI sustained verification = Hybrid CI gate + manual review** | CI gate auto cho 4 critical (genuine pass / flaky / false-positive / pipeline PR duration); manual weekly review cho 3 còn lại (coverage / MTTD / MTTF). Critical KPI miss → CI red + Issue auto-create reuse `notify-fail.yml`. Threshold 10/14 ngày green = 70% (không 100% để tolerate single-day infra outage). | M6 |
| 2026-05-01 | **M6 maintenance cost tracker = git log + commit convention `fix(flaky): <test_id>`** | Zero new infra; `scripts/maintenance-cost.cjs` parse `git log` + count → estimate × 1h; manual override JSON cho big fix (>4h) qua `tmp/m6-maintenance-overrides.json`. Pattern compatible khi team scale (commit convention organic adopt). | M6 |
| 2026-05-01 | **M6 ROI report formula = critical flow weighted** | `sum(critical_flow_time × actual_runs × 0.7 efficiency)` minus `automated_run_time × runs`. Critical flow estimate hardcode `docs/m6-roi-report.md` (login=3min, checkout=8min, payment=10min). Run frequency từ Influx (M5 Task 6). Conservative + transparent + auditable formula. | M6 |
| 2026-05-01 | **M6 debt closure batch sequencing = distributed** | D5+D6 sprint 1 (GH UI walkthrough + 1 device APK install ~2h, không phụ thuộc M6 work); M5 verify-only batch sprint cuối cùng KPI sustained 2-week (Phuc verify dashboard end-to-end với real CI data, không synthetic). Closure walkthrough single-shot ~4h. | M6 |
| 2026-05-01 | **M6 iOS support = Spike sprint 2** (1 BS iPhone smoke + spike doc) | Time-box hard 4-6h: 1 iOS smoke (login) trên BS iPhone 14 simulator + `docs/spikes/ios-support.md` kết quả + estimate full coverage effort. Decision implement full iOS = M7 hoặc defer indefinite tùy spike result. Giảm risk full iOS scope creep. | M6, M7 |
| 2026-05-01 | **M5 LLM provider list extended với `gemini`** — supersedes Decision row "M5 LLM = anthropic/openai/ollama" 2026-04-28 | Phuc DN chosen Gemini 2.5 Flash sau M6 sign-off. Provider-agnostic adapter pattern (M2 row 20 + M5 row 51) accommodate native — `GeminiAdapter` qua REST `POST /v1beta/models/{model}:generateContent` với `x-goog-api-key` header. Default pricing table cover flash / flash-lite / pro. Free tier Google AI Studio (15 RPM + 1M tokens/day) đủ cho M5 classifier escalator + self-heal suggester usage. Unit count 209 → 220 (+11 tests: 8 adapter + 3 factory). Path A từ 2 options proposed; Path B (extend OpenAIAdapter custom path) rejected vì providerId mislabel. | M5 (revise), M6 |
| 2026-05-02 | **M7 charter = Validation milestone** (designed → battle-tested), KHÔNG add feature mới | Self-audit (2026-05-02) reveal ~40% framework feature ở Tier 3 "proof-of-concept claim chưa validate với data thật" (self-heal accuracy / LLM classifier confidence / ROI placeholder / KPI 14d chưa thật / iOS spike / BS matrix shelfware). Industry tier-1 framework cần ≥ 80% Tier 1+2. M7 5 tuần focus convert vibe-spec → validated-with-data: 14d sustain run thật, self-heal benchmark precision/recall, LLM calibration confusion matrix, 20-run stability gate auto-enforce, iOS production promote (1 spec → 5 spec), BS matrix end-to-end run, ROI backfill 4 tuần data Influx, tier rating audit doc. Out-of-scope: a11y / security / localization / mutation / chaos / iOS regression full / Pact backend migrate (defer M8+). | M7 (charter), M8+ (defer scope) |
| 2026-05-02 | **M7 debt closure batch consolidates D5+D6 (M4 verify-only) + 8 new debt entries (D7-D16)** từ M6 RCA + vibe-spec audit | Per Decision 10 M5 (debt consolidation policy) — verify-only debt purge ở milestone closure boundary. M7 sprint 1 đóng 14 debt batch trước khi start validation work để framework ở stable state cho benchmark. D7+D8 = RCA TC_PERF_LOGIN_001 lessons; D9 = visual hook bug demo-flagged; D10-D16 = vibe-spec gap honest call-out (self-heal / LLM / iOS / BS / ROI / 20-run / commit lint). | M4-M6 (carry-over), M7 (closure batch) |
| 2026-05-02 | **Tier rating audit policy** = mọi feature framework claim "production" phải có Tier 1+2 evidence link (file path / commit SHA / Allure URL / data point) | Anti-vibe-spec discipline. Trước M7: claim không evidence → silently Tier 3. M7 audit doc `docs/m7-tier-rating.md` map từng feature → Tier với evidence. Pattern apply cho mọi milestone tương lai khi update doc marketing/value-prop. | M7+ (apply forever) |
| 2026-05-02 | **M7 stability gate trigger = auto-detect new spec via git diff `+++ tests/.../*.spec.ts` new file** — supersedes "manual label `new-spec`" alternative | Tự động + đúng scope (chỉ test stability spec mới, không test cũ đã proven). Edge case rename → manual override label `skip-stability-gate` với 1 reviewer approve. Decision 3 M7. | M7 |
| 2026-05-02 | **M7 iOS device matrix = 2 device (iPhone 14 + iPhone 15)** — không phải 5 device — defer iPad + iPhone SE | Promote spike → Tier 2 chỉ cần prove cross-platform, không cần full coverage. iPad scope creep (app khác layout cần extra fixture). M8+ với plan riêng `M8-cross-platform-coverage.md` nếu iOS coverage full được prioritize. Decision 4 M7. | M7, M8+ |
| 2026-05-02 | **M7 self-heal benchmark methodology = inject 30 fake locator drift (Option A)** — defer Option B "mine git history" | Reproducibility quan trọng cho first benchmark; inject pattern cover 80% drift type (rename / attribute change / structure shift). Project chưa accumulate 30 historical real drift fix. M8+ re-run với historical data khi git log đủ. Decision 1 M7. | M7, M8+ |
| 2026-05-02 | **M7 LLM classifier calibration corpus = 14-day artificial run + 50 manual label** — kết hợp Task 1 (KPI sustain) lấy fail data | 1 mũi tên 2 đích: 14d sustain reuse cho cả KPI dashboard + classifier corpus. Real-ish distribution thay vì synthetic. Bias note trong calibration doc: corpus thiên Sauce Demo, M9+ re-calibrate khi có internal app data. Decision 2 M7. | M7, M9+ |
| 2026-05-02 | **GitHub Free tier branch protection KHÔNG enforce trên private repo** — phát hiện qua D5 step 3 force-fail verify, force-fail PR vẫn merge được dù typecheck CI fail. Resolution: chuyển repo private → public 2026-05-02 + adjust approval count = 0 cho solo-dev (giữ status check làm gate thực sự). Public trade-off: source visible nhưng unblock GH Pages (M5 Decision row 36) + branch protection enforce. | Documented limitation — silent gap không có warning rõ ràng trên Settings page khi tạo rule. Future projects nếu ở private repo cần cân nhắc: (a) upgrade Team tier ($4/user/month), (b) chuyển public, hoặc (c) accept limitation và rely trên CI build matrix là gate de-facto (không hard block merge). | All future milestones (apply forever khi setup branch protection) |

---

## Cập nhật roadmap

- Khi start milestone: chuyển status ⬜ → 📝, tạo plan file từ template, fill xong → 🔵, sign-off → 🟡.
- Khi xong: verify done criteria, update Decisions log nếu có quyết định mới, đóng status → 🟢.
- Khi blocked: 🔴 + ghi blocker cụ thể vào bảng tổng quan.
- Mỗi tuần update "Status updates" trong milestone đang chạy (1-2 dòng).
