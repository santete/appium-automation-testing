# M2 — Validation Framework

> Implementation plan cho milestone M2. Workflow đầy đủ xem `docs/plans/README.md`.

## Metadata

| Field | Value |
|-------|-------|
| Milestone ID | M2 |
| Spec section | `automation_testing_requirement.md` §5 + §11 Phase 2 |
| Status | 🔵 Plan ready (signed-off 2026-04-27, ready to execute) |
| Plan author | Claude + Phuc DN |
| Plan version | v1.0 (signed-off pending Phuc DN) |
| Created | 2026-04-27 |
| Sign-off date | 2026-04-27 |
| Sign-off by | Phuc DN |
| Target start | 2026-04-28 |
| Target end | 2026-05-19 (3 tuần — spec §11 Phase 2 = Week 4-6) |
| Actual start | — |
| Actual end | — |

---

## 1. Goal

Xây `AssertionRunner` + Assertion Contract YAML format → **mọi test verdict được tính bằng cách compose assertion từ ≥1 layer (UI/API/State)** với severity-driven flow control. Convert smoke test TC_LOGIN_001 (đang single-layer UI) sang chạy qua contract → **đóng Debt D1**.

## 2. Done criteria (acceptance test)

> Test fail có thể **chỉ rõ** fail ở layer nào (UI / API / State / Performance / Negative), với evidence đầy đủ tự động vào Allure.

**Acceptance test cụ thể:**
1. Inject lỗi UI (locator sai) → verdict `FAIL`, failure metadata `layer: UI`, route to step 4.
2. Inject lỗi API (schema mismatch) → verdict `FAIL`, `layer: API`, route to step 1 hoặc dev.
3. Inject lỗi State (token không persist) → verdict `FAIL`, `layer: STATE`, route to step 4.
4. High-severity perf fail nhưng critical pass → verdict `PASS_WITH_WARNINGS` (không stop).
5. Critical fail → AssertionRunner stop early, không chạy assertion sau.
6. Smoke test TC_LOGIN_001 chạy qua `AC_LOGIN_001.yaml` contract → pass với UI + State assertion (Sauce Demo không có backend nên API layer được test riêng qua mock).
7. Chạy 5 lần liên tục → 5/5 pass (no flaky).
8. Allure report show: per-layer verdict, soft-assertion list (cả pass + fail).

## 3. Scope

### In scope
- `src/utils/assertion/AssertionRunner.ts` — core engine load contract YAML, execute checks, compute verdict.
- `src/utils/assertion/types.ts` — TypeScript types: `AssertionContract`, `Severity`, `Verdict`, `AssertionResult`, `FailureMetadata`.
- `src/utils/assertion/loader.ts` — YAML parse + Zod schema validation (fail-fast nếu contract invalid).
- `src/utils/assertion/checkers/` — 1 checker per layer:
  - `UiChecker.ts` — eval UI predicates (visible, text equals, attribute match, …).
  - `ApiChecker.ts` — chạy HTTP request + Zod schema validation, status check, header check.
  - `StateChecker.ts` — query app state qua **Appium `mobile:executeScript`** (preferred) hoặc **adb shell run-as** (fallback cho native).
  - `NegativeChecker.ts` — predicate trên log capture (logcat) + crash flag.
  - `PerfChecker.ts` — time delta giữa 2 marker (start_action → end_action).
- `src/utils/apiClient.ts` — Axios + Zod helper (factory: `createApiClient(baseURL)` → instance với schema-validated `request()` method).
- `src/utils/logCapture.ts` — Appium `getLogs('logcat')` wrapper + filter regex.
- `src/contracts/_schema.ts` + `src/contracts/_schema.yaml` — Zod schema cho contract format.
- `src/contracts/AC_LOGIN_001.yaml` — repay D1: contract cho TC_LOGIN_001.
- Allure integration: mỗi assertion result emit 1 Allure step với pass/fail + severity + evidence path.
- Soft assertion: high/medium/low fails không throw, gom lại cuối test thành 1 verdict object → attach Allure.
- Unit tests: `tests/unit/assertion-runner.spec.ts` — verify computeVerdict logic, severity flow, schema validation, ≥80% line coverage.
- Integration test: `tests/integration/contract-execution.spec.ts` — chạy contract giả lập với mock checkers, verify orchestration đúng.
- Migrate `tests/smoke/login.spec.ts` → call `AssertionRunner.runContract('AC_LOGIN_001')`, xóa `expect(visible).to.equal(true)` thủ công.

### Out of scope (explicit — defer)
- ❌ **Pact contract testing** — defer M4 (cần real backend integration).
- ❌ **Visual regression** (`visual:` block trong contract) — defer M5/M6 (Applitools/Percy decision).
- ❌ **Real API integration với app team backend** — Sauce Demo App không có backend; mock + contract framework đủ để chứng minh M2 done. Real integration ở M3 khi có app thật.
- ❌ **Auto-routing của failure metadata** (route to dev/qa team thật) — chỉ emit `FailureMetadata.routeTo` field, KHÔNG send Slack/Linear. Routing thực thi ở M5 (auto-classification).
- ❌ **Knowledge base auto-update** từ failure — M5.
- ❌ **Network simulation** (slow 3G, packet loss) — M3 (network sim hook).
- ❌ **Self-healing locator suggestions** — M5.

## 4. Technical decisions

> Mỗi decision có đề xuất + rationale. **Cần Phuc DN confirm trước khi chuyển 🔵 Plan ready.**

### Decision 1: Schema validation library
- **Plan checklist:** Zod / Joi / Ajv?
- **Options:**
  - **A. Zod** — TypeScript-first, type inference qua `z.infer<>`, ergonomics tốt nhất; bundle size nhỏ.
  - B. Ajv — JSON Schema standard, fastest, nhưng cần viết JSON Schema riêng (DX kém hơn).
  - C. Joi — runtime-only, không type inference cho TS.
- **Đề xuất:** **Option A — Zod**. CLAUDE.md đã list Zod trong planned stack; Zod schema vừa validate contract YAML, vừa validate API response trong `ApiChecker`.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 2: State layer access strategy
- **Plan checklist:** qua app's debug API hay trực tiếp DB?
- **Options:**
  - A. **App debug API** — clean, không phụ thuộc internals, nhưng cần app build có debug endpoint.
  - B. **Direct adb shell** (`run-as <pkg> cat shared_prefs/...`) — không cần app cooperation, nhưng intrusive + chỉ Android + cần debuggable APK.
  - **C. Appium `mobile:executeScript`** primary + adb shell fallback — abstraction `StateChecker` với 2 backend, contract chỉ define semantic check, runner pick backend.
- **Đề xuất:** **Option C**. Sauce Demo App không có debug API (out of our control), nhưng debuggable nên adb shell work. Khi M3+ có app team thật, switch sang debug API mà KHÔNG đổi contract.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 3: Severity → action mapping
- **Plan checklist:** critical = stop immediately?
- **Spec §5.3 đã quy định:** critical → stop + FAIL; high → continue + FAIL cuối; medium → warning + PASS_WITH_WARNINGS; low → info + PASS.
- **Đề xuất:** **Tuân thủ spec §5.3 nguyên văn.** Thêm 1 rule: "critical (security)" (vd. `no_pii_in_logs`) → cùng treatment như critical thường, nhưng emit thêm `securityImpact: true` flag vào FailureMetadata để M5 prioritize.
- **Status:** ⏳ Cần confirm (đặc biệt rule security).

### Decision 4: Negative assertion via log capture
- **Plan checklist:** implement thế nào — log capture hook?
- **Options:**
  - A. **Appium `getLogs('logcat')`** sau test → grep regex (đơn giản, post-hoc).
  - B. **Streaming logcat qua adb logcat** subprocess (real-time, complex).
- **Đề xuất:** **Option A** cho M2 — `LogCapture.fetchAndScan(regex[])` chạy trong `afterEach` (sau test logic, trước on-fail screenshot). Streaming defer khi cần (M5 observability).
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 5: API layer cho TC_LOGIN_001 (vì Sauce Demo không có backend)

#### 5a. API layer assertion kiểm tra cái gì?
- **Options:**
  - **(I) Test code (Node) tự call API** để verify backend state — vd. `GET /api/users/me` trả user data. Độc lập với network của app.
  - (II) Capture network của app qua proxy (HAR/mitmproxy) — sniff traffic, assert.
- **Decision:** **(I)** — `ApiChecker` thực hiện HTTP request từ Node, KHÔNG intercept app traffic. Đơn giản, không cần proxy infra. (II) defer M5 nếu cần.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

#### 5b. Test ApiChecker ở đâu khi Sauce Demo offline?
- **Decision:** **MSW (Mock Service Worker) — Node-side**. Boot trong `before` hook của integration test, axios trong ApiChecker bị MSW intercept. Không cần process riêng/port management. WireMock save cho M4 nếu cần shared mock multi-shard CI.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

#### 5c. AC_LOGIN_001.yaml có những layer nào?
- **Decision:** **UI + State + Negative**. KHÔNG có `api_layer` block (Sauce Demo offline). Framework's API capability được verify riêng qua `AC_API_DEMO.yaml` + MSW trong integration test.
- **Acquire Debt D3** — repay M3 khi swap real app.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 6: Soft assertion mechanism
- **Question (mới):** dùng built-in của Chai (`expect.soft`), expect-webdriverio, hay tự build?
- **Đề xuất:** **Tự build trong AssertionRunner** — `runner.results[]` accumulate kết quả, runner trả `Verdict` object cuối. Không dùng Chai soft (vì Chai chỉ work trong `it()` block, runner cần work cho cả unit test). Chai vẫn dùng cho assertion atomic trong checkers nội bộ.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 7: Contract storage location
- **Question (mới):** `src/contracts/*.yaml` (như spec §10.3) hay `tests/<suite>/contracts/*.yaml`?
- **Đề xuất:** **`src/contracts/`** theo spec — global registry, contract reusable across suites. Convention naming: `AC_<TC_ID>.yaml`.
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 8: Contract YAML expression language

- **Decision:** **Structured discriminated union với type registry** (Zod-validated). Mỗi assertion có field `type` discriminator → map sang 1 method trong checker tương ứng. KHÔNG có eval / sandbox.
- **Type registry M2** (extend ở M3+ qua code change có review):

| Layer | Type | Required params |
|-------|------|-----------------|
| UI | `element_visible` | `locator` |
| UI | `element_absent` | `locator` |
| UI | `text_equals` | `locator`, `expected` |
| UI | `attribute_match` | `locator`, `attribute`, `regex` |
| API | `http_request` | `method`, `url`, `headers?`, `body?`, `expect{status, schema_ref?}` |
| State | `state_property` | `source` (`shared_prefs`/`secure_storage`/`debug_api`), `key`, `expect{equals\|not_null\|regex}` |
| Negative | `log_pattern_absent` | `log_source`, `pattern` (regex) |
| Negative | `process_alive` | `package` |
| Perf | `time_between` | `start_marker`, `end_marker`, `max_ms` |

- **Rationale:**
  - Contract YAML invalid được phát hiện **ngay khi load** (Zod báo `positive.ui_layer[0]: missing 'locator'`).
  - Không có injection risk.
  - M5 self-healing AI generate dễ vì output structure cố định.
  - Mỗi type = 1 unit-testable function trong checker.
- **Trade-off accepted:** verbose hơn ~30%, thêm type mới = code change (em coi là feature, buộc review trước khi extend).
- **Compound condition** (X AND Y): tách thành nhiều assertion, không gộp 1 dòng.
- **Future escape hatch** (defer M3+): thêm `type: custom_predicate` ref function trong `src/contracts/_predicates.ts` (TS function, vẫn không eval).
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

### Decision 9: API mock library cho integration test
- **Question (mới — tách ra từ Decision 5b):** MSW vs WireMock vs nock?
- **Options:**
  - **A. MSW (Mock Service Worker)** — Node-side intercept axios, no process, lifecycle gắn với test runner.
  - B. WireMock — Java standalone server, cần process riêng + port management.
  - C. nock — Node-side, lightweight nhưng API kém ergonomic, không support OpenAPI.
- **Decision:** **A — MSW**. CLAUDE.md đã list. WireMock save M4 (shared mock cross-shard CI).
- **Status:** ✅ Confirmed by Phuc DN 2026-04-27.

## 4b. Accepted debts (M2 acquires)

> Tất cả debt phải log vào `ROADMAP.md` Debt log + verify đóng khi repay milestone DONE.

| ID | Debt | Spec section | Repay in | Verification when repaid |
|----|------|--------------|----------|--------------------------|
| **D3** | `AC_LOGIN_001.yaml` không có `api_layer` block (Sauce Demo offline) | §5.2 multi-layer, §1.3 | M3 | Contract `AC_LOGIN_001.yaml` có ≥1 assertion `api_layer`, hit endpoint thật, fail simulation backend 500 → verdict FAIL `layer: API` |
| **D4** | `StateChecker.adb_shell` backend chỉ work với debuggable APK | §5.2 state_layer, §3 step 4 | M3 (real app expose debug API) hoặc M4 (BrowserStack run-as flag) | StateChecker có `mobile:executeScript` backend hoạt động trên release APK; test cả 2 path pass |

**Risk discovery trong M2 task 12:** Khi inspect Sauce Demo SharedPreferences, nếu app **không lưu state nào** ở shared_prefs → phải skip `state_layer` trong AC_LOGIN_001 → debt D3 nâng cấp thành "missing API + State, chỉ UI + Negative". Plan revision §12 sẽ document lại.

## 5. Task breakdown

| # | Task | Deliverable | Estimate | Status | Skill |
|---|------|-------------|----------|--------|-------|
| 1 | Define types + Zod schema cho contract | `src/utils/assertion/types.ts` + `src/contracts/_schema.ts` | 4h | 🟢 | `assertion-contract` |
| 2 | Contract YAML loader + validator | `src/utils/assertion/loader.ts` | 3h | 🟢 | `assertion-contract` |
| 3 | UiChecker | `src/utils/assertion/checkers/UiChecker.ts` + `wdioUiCheckerDeps.ts` | 3h | 🟢 | `test-implement` |
| 4 | ApiChecker + apiClient (Axios + Zod) | `src/utils/apiClient.ts` + `ApiChecker.ts` + `axiosApiCheckerDeps.ts` | 5h | 🟢 | `test-implement` |
| 5 | StateChecker (Appium executeScript + adb fallback) | `src/utils/assertion/checkers/StateChecker.ts` + `adbStateCheckerDeps.ts` | 5h | 🟢 | `test-implement` |
| 6 | NegativeChecker + LogCapture | `src/utils/logCapture.ts` + `NegativeChecker.ts` | 3h | 🟢 | `test-implement` |
| 7 | PerfChecker (time markers) | `src/utils/assertion/checkers/PerfChecker.ts` | 2h | 🟢 | `test-implement` |
| 8 | AssertionRunner orchestrator + verdict logic | `src/utils/assertion/AssertionRunner.ts` | 5h | 🟢 | `assertion-contract` |
| 9 | Allure integration (per-step + verdict attach) | `src/utils/assertion/allureReport.ts` | 3h | 🟢 | `test-implement` |
| 10 | Unit tests cho AssertionRunner (verdict logic, severity flow) | `tests/unit/assertion-runner.spec.ts` + `checkers.spec.ts` + `loader.spec.ts` (31 tests) | 4h | 🟢 | `test-validate` |
| 11 | Integration test: contract execution end-to-end | `tests/integration/contract-execution.spec.ts` (6 tests, MSW) | 3h | 🟢 | `test-validate` |
| 12 | **[Repay D1]** Migrate TC_LOGIN_001 → contract | `src/contracts/AC_LOGIN_001.yaml` + sửa `tests/smoke/login.spec.ts` | 3h | 🟢 | `assertion-contract` |
| 13 | Acceptance test (8 bước section 2) + 5x stability | report evidence | 3h | 🟡 | `test-validate` |
| 14 | Update ROADMAP (M2 → 🟢, close D1) + lessons learned | `ROADMAP.md`, plan §13 | 1h | 🟡 | — |

**Total estimate:** ~47h (~6 ngày dev), buffer cho 3 tuần plan (Phase 2 Week 4-6 spec §11).

## 6. Dependencies

### Upstream
- [x] M1 done (foundation, smoke test working baseline) — confirmed 2026-04-27.
- [ ] Decisions 1-8 §4 sign-off.

### Downstream
- M3 (Test Data) cần `apiClient` từ M2 cho `UserFactory` create/cleanup qua API.

### External
- Không có external dependency mới — Zod / js-yaml / chai đã trong package.json sẵn (sẽ verify khi install).

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `mobile:executeScript` không expose được state cần (Sauce Demo không có debug hook) | High | Medium | Fallback adb shell run-as cho debuggable APK; document constraint cho M3+ real apps cần expose debug API |
| AssertionRunner orchestration bug → false PASS (verdict tính sai) | Medium | Critical | Unit test bao trùm matrix [severity × pass/fail × layer] = 16 case minimum |
| YAML schema thay đổi sau khi viết nhiều contract | Medium | High | Version contract format ở field `schema_version` ngay từ đầu (`v1`); migration script khi đổi |
| Soft assertion + Allure step async ordering loạn (steps log không đúng thứ tự) | Medium | Medium | Mỗi check mở 1 Allure step rồi close ngay; không nest async lâu |
| Zod validation messages khó đọc cho user viết contract | Low | Low | Wrap Zod errors qua custom formatter "Contract AC_LOGIN_001 invalid: positive.ui_layer[0].severity must be one of ..." |

## 8. Test plan (verify deliverables)

- [ ] Acceptance test 8 bước section 2 pass với evidence trong Allure.
- [ ] Unit test `assertion-runner.spec.ts` ≥80% line coverage; CI script `npm run test:unit` thêm vào package.json.
- [ ] Integration test `contract-execution.spec.ts`: 5 case (UI fail, API fail, State fail, perf-only fail = PASS_WITH_WARNINGS, all-pass = PASS).
- [ ] Smoke `tests/smoke/login.spec.ts` sau migration: 5/5 pass.
- [ ] ESLint pass — không có anti-pattern (no `pause`, no `setTimeout`, no `eval` nếu Decision 8 pick B).

## 9. Rollback plan

Nếu phải hủy M2 giữa chừng:
- Revert `tests/smoke/login.spec.ts` về single-layer UI assertion (D1 vẫn open).
- Giữ lại `src/utils/assertion/` code cho M2 retry, không xóa.
- Update ROADMAP M2 → ⬜ + ghi reason vào Decisions log.

## 10. Sign-off checklist

Trước khi chuyển status → 🔵 Plan ready:

- [x] 9 decisions §4 đều có answer (1-9 confirmed 2026-04-27)
- [x] Acceptance test 8 bước rõ ràng, có thể verify
- [x] Scope out-of-scope explicit (đặc biệt Pact + visual + real API)
- [x] Risks đã thảo luận
- [x] D1 plan repay rõ ràng (Task 12)
- [x] Debts acquire (D3, D4) tracked vào §4b + ROADMAP Debt log
- [x] Stakeholder Phuc DN approve plan v1.0 — 2026-04-27

## 11. Status updates (weekly)

| Date | Update | Blockers |
|------|--------|----------|
| 2026-04-27 | Plan v0.1 draft, 8 decisions cần Phuc DN confirm | Pending sign-off §4 |
| 2026-04-27 | Plan v1.0 sign-off — Phuc DN confirm 1-7 + clarification 5/8 → split 5 thành 5a/5b/5c, thêm Decision 9 (MSW). Debt D3 + D4 logged. Status → 🔵 Plan ready. | None |
| 2026-04-27 | Tasks 1-12 🟢 trong 1 session. 31 unit + 6 integration tests pass. Build + lint clean. Task 13 acceptance: 5/8 sub-points verified by tests, 3/8 (smoke device run) cần user execute manual theo `docs/runbook-M2-acceptance.md`. Status → 🟡 In progress (chờ device run). | Cần emulator + smoke 5x để close M2 |
| 2026-04-27 | Device acceptance done — smoke 5/5 PASS (durations: 25.0/25.1/24.7/25.2/39.9s, avg ~28s). Allure verified: verdict.json attachment + 5 per-layer steps + labels (`contract_id`, `verdict`, `UI_layer=3/3`, `NEGATIVE_layer=2/2`). 2 bugs hit & fixed: (i) post-login race condition — `AssertionRunner` không tự wait, phải gọi explicit `waitForVisible('~test-Cart')` trước khi run UI checks; (ii) NPE pattern broad — đổi sang `Process:\s*com\.swaglabsmobileapp` để scope theo app crash dump (system NPEs từ TapAndPay/dlpn không còn false-fail). Task 13 + 14 🟢. Status → 🟢 Done. | None |

## 12. Plan revisions

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| — | — | — | — |

## 13. Closure

**M2 closed 2026-04-27.** Device acceptance smoke 5/5 PASS, Allure attachments verified.

- [x] Tất cả deliverables ở section 5 = 🟢 (14/14 tasks)
- [x] Acceptance test 8 bước pass với evidence — 5/8 by automated tests + 3/8 by device run (smoke 5x, Allure verified)
- [x] Debt D1 đóng — `tests/smoke/login.spec.ts` chạy qua `AC_LOGIN_001.yaml` contract + `AssertionRunner`. KHÔNG còn `expect(visible).to.equal(true)` hardcoded
- [x] Decisions log §4 final (1-9 confirmed)
- [x] ROADMAP.md status M2 = 🟢

### Lessons learned

1. **DI cho mọi checker thắng lớn về testability.** 31 unit tests chạy 27ms total (no Appium boot). Nếu không tách `UiCheckerDeps` từ `$()`, mỗi unit test phải boot WDIO — vô lý cho logic test.

2. **Node 22 built-in TS strip vs ts-node conflict.** Mocharc cần explicit `'node-option': ['no-experimental-strip-types']` để parameter properties (`constructor(private foo: T)`) compile được. Đây là M3+ landmine khi Node bump version — pin trong `.mocharc.*.cjs`.

3. **Discriminated union trade-off đúng như đã accept ở Decision 8.** Mỗi check type = 1 case `switch` + 1 Zod variant = 1 unit test. Verbose nhưng không có injection risk + AI generate dễ. Khi M3 cần thêm type, friction = đúng feature.

4. **MSW v2 + axios + Node 22 just works.** Không cần config undici interceptor manually — `setupServer().listen()` intercept axios trực tiếp. Integration test nhanh (~283ms cho 6 tests).

5. **FailureMetadata routing heuristic đủ cho M2.** Chỉ dựa layer (UI→4, API→1, …). M5 sẽ augment qua history (reproducible? flaky? env-specific?). Đã thiết kế interface đủ chỗ chứa data thêm.

6. **Hybrid spec/types từ Zod = single source of truth.** `_schema.ts` định nghĩa Zod schema → `z.infer<>` cho type → loader validate runtime, runner consume type-safe. KHÔNG có type drift giữa runtime và compile-time.

7. **Allure reporter import lazy** (`getDefaultAllure()` async) tránh crash unit test environment. Pattern này tổng quát: bất kỳ runtime singleton nào (Allure, browser, driver) phải lazy + injectable.

8. **adb adapter cho StateChecker là acceptable M2 debt (D4).** Sauce Demo offline → state_layer skip M2 (D3). Khi M3 swap real app, adapter có thể fail vì release APK không debuggable — đã document trong `adbStateCheckerDeps.ts` để future agent hiểu trade-off.

9. **AssertionRunner KHÔNG tự wait — caller phải gate readiness.** Khi refactor smoke test M1 sang contract pattern, mất đi explicit `waitForVisible(cartIcon, {timeout: 15000})` của M1 → race condition: `loginPage.login()` resolves trước khi cart render xong → UI check fail. Pattern cố định: **mọi spec file phải gọi readiness wait sau action chính trước khi `runner.runContractById()`**. Document trong test-implement skill khi update M3+.

10. **Negative log pattern phải scope theo app, không generic.** Pattern `NullPointerException` bắt cả NPE của system services (TapAndPay, dlpn, A) — false-fail vì không liên quan app under test. Pattern chuẩn: `Process:\s*com\.<package>` (chỉ xuất hiện khi AndroidRuntime ghi FATAL EXCEPTION dump cho process này) hoặc `<TAG>.*<exception>`. Cần KB pattern rule cho M5: "negative log_pattern_absent phải có app/process scope".
