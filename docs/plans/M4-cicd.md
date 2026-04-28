# M4 — CI/CD Integration

> Implementation plan cho milestone M4. Workflow đầy đủ xem `docs/plans/README.md`.

## Metadata

| Field | Value |
|-------|-------|
| Milestone ID | M4 |
| Spec section | `automation_testing_requirement.md` §7 + §11 Phase 4 |
| Status | 🟡 In progress (v1.0 signed-off 2026-04-28; Task 1+2+3+4+5+8+12/19 done 2026-04-28) |
| Plan author | Claude + Phuc DN |
| Plan version | v1.0 (signed-off 2026-04-28) |
| Created | 2026-04-28 |
| Sign-off date | 2026-04-28 |
| Sign-off by | Phuc DN |
| Target start | 2026-04-29 (sau khi sign-off) |
| Target end | 2026-05-20 (3 tuần — spec §11 Phase 4 = Week 10-12) |
| Actual start | 2026-04-28 (Task 1 — repo bootstrap, sớm hơn target 1 ngày) |
| Actual end | — |

---

## 1. Goal

Test **non-device tier** (typecheck + lint + unit + integration + api) chạy tự động trên PR + nightly via GitHub Actions, fail block merge; Slack notify; Allure GH Pages cho integration; quarantine list mechanism với deadline enforcement. **Smoke E2E giữ local-dev** (real device dev, không wire device farm M4). **Trả nốt D4** (real-device verification cho `StateChecker.mobile:executeScript` backend qua debuggable test APK chạy trên dev device — config-driven cho M5+ wire BS/SL).

> **Q2 sign-off update (2026-04-28)**: Phuc DN — "chưa cần device farm bây giờ, ưu tiên real device của dev, config-driven nếu cần thiết". Plan revision: BS wire-up defer M5+, smoke E2E local-only verify gate, CI scope = non-device tier.

## 2. Done criteria (acceptance test)

> PR mở → CI gate (typecheck + lint + unit + integration + api) chạy **< 5 phút**, fail **block merge**; nightly regression fail → **notify Slack** trong < 5 phút; smoke E2E manual verify gate (PR description checklist mục); D4 real-device verify pass trên dev device.

**Acceptance test cụ thể:**
1. **Repo + CI bootstrapped**: codebase init git + push lên `github.com/santete/appium-automation-testing`. Default branch `main`. Branch protection: required check `ci / verify`, 1 review required.
2. **CI gate trên PR**: PR open với 1 commit vô hại → workflow `ci.yml` chạy typecheck + lint + unit (54) + integration (8 + 2 gated) + api (1), tổng wall < 5 phút, all pass; Allure artifact (integration only) uploaded.
3. **CI fail block merge**: PR với forced break (xoá file `_schema.ts`) → typecheck/unit FAIL, GitHub status check RED, "Merge" button disabled; Slack `#pr-failures` notified.
4. **Nightly regression**: cron `0 2 * * *` (UTC) → workflow `regression.yml` chạy full non-device suite + integration với `ALLOW_NETWORK_INTEGRATION=1` (real httpbin); duration < 10 phút; Allure deploy GitHub Pages tại `santete.github.io/appium-automation-testing/<run-id>/`.
5. **Nightly fail notify**: failure → Slack `#qa-alerts` với link Allure + failure summary (test_id, layer).
6. **Quarantine list**: `docs/quarantine.yaml` schema `{ test_id, reason, added, deadline, owner }`; custom Mocha hook đọc YAML, future-deadline → skip, past-deadline → throw fail; CI gate enforce.
7. **D4 real-device repay (local-dev gate)**: build debuggable test APK trong `apps/test-debuggable-src/`; integration spec `tests/integration/state-checker-mobile-real.spec.ts` chạy LOCAL trên dev Android device (config-driven `wdio.local.ts` capability); `mobile:executeScript` backend lookup shared_prefs → state assertion PASS. Phuc verify thủ công 1 lần trước khi đóng D4.
8. **Smoke local verify gate**: PR description có checklist mục "[ ] `npm run test:smoke` PASS local trên dev device + screenshot/log link". Reviewer enforce gate; CI không block automatic. (Tradeoff explicit: faster CI vs honor-system smoke verify — accepted per Q2.)
9. **Device farm config-driven stub**: `src/config/wdio.bs.ts` + `wdio.sauce.ts` skeleton load env BS_USER/BS_KEY (placeholder), KHÔNG wire actual run M4. M5+ swap activate khi có account.

## 3. Scope

### In scope
- **Repo bootstrap**: `git init`, initial commit (đầy đủ M1-M3), push GitHub `santete/appium-automation-testing`, README badges (CI status, Allure link).
- **CI workflow** (`.github/workflows/ci.yml`): trigger `pull_request` to `main` + push to main; jobs: `verify` (typecheck + lint + unit + integration + api). Single Linux GH-hosted runner — non-device tier không cần Android.
- **Regression workflow** (`.github/workflows/regression.yml`): cron 2AM UTC + manual `workflow_dispatch`; same suite + `ALLOW_NETWORK_INTEGRATION=1` (real httpbin); deploy Allure GH Pages.
- **Slack notification**: `slackapi/slack-github-action` cho PR failure (`#pr-failures`) + nightly failure (`#qa-alerts`).
- **Allure publish**: `peaceiris/actions-gh-pages` deploy step; integration test runs đủ rich Allure data.
- **Branch protection**: enable trên `main` qua `gh api`; require check `ci / verify` + 1 review; force-push blocked.
- **Quarantine mechanism**: `docs/quarantine.yaml` schema + custom Mocha hook (`tests/_hooks/quarantine.ts`) + Zod validation; CI step `scripts/check-quarantine.cjs` enforce deadline.
- **Pipeline duration baseline**: workflow append CSV (commit hoặc Gist) cho future M5 dashboard hooks.
- **Smoke local verify gate**: PR template `.github/PULL_REQUEST_TEMPLATE.md` với checklist "smoke local PASS + evidence link"; documented trong runbook.
- **Device farm config-driven stub**: `src/config/wdio.bs.ts` skeleton (env loader BS_USER/BS_KEY, capabilities scaffold). KHÔNG wire actual BS account M4. M5+ activate. Cho phép future swap không re-architect.
- **D4 real-device verification (carry-over từ M3 — local-dev path)**:
  - `apps/test-debuggable-src/` — minimal Android Studio project (Kotlin/Java, Gradle wrapper checked in), 1 Activity write SharedPreferences key `m4_state_test_key=ok`.
  - Build script `scripts/build-test-apk.cjs` chạy `gradlew assembleDebug` → output `apps/test-debuggable.apk`.
  - `tests/integration/state-checker-mobile-real.spec.ts` — chạy LOCAL trên dev Android device qua WDIO; install debuggable APK, write pref, lookup qua `mobile:executeScript` → assert match. Phuc verify thủ công 1 lần.

### Out of scope (explicit — defer)
- ❌ **Device farm wire-up (BrowserStack/Sauce Labs/Firebase)** — defer M5+ per Q2 sign-off ("chưa cần device farm bây giờ"). Stub config-driven cho M5+ swap dễ.
- ❌ **Smoke E2E trong CI** — local-dev only M4. Wire qua self-hosted runner hoặc device farm khi M5+ cần.
- ❌ **Sharding** — single CI job, suite hiện < 30s; sharding overengineering M4. Activate khi suite scale > 5 phút.
- ❌ **iOS support** — defer M5/M6.
- ❌ **Self-hosted CI runner** — defer M5+ nếu cần smoke E2E auto.
- ❌ **Grafana + InfluxDB dashboard** — defer M5.
- ❌ **ReportPortal AI analysis** — defer M5.
- ❌ **Auto-quarantine khi pass rate < 90%** — defer M5.
- ❌ **Self-healing locator AI** — defer M5.
- ❌ **Pact contract testing** — defer M6.
- ❌ **Visual regression** — defer M6.
- ❌ **Cross-device matrix** — defer M6.
- ❌ **`develop` branch protection** — project 1 branch.
- ❌ **Performance test integration** — defer M6.

## 4. Technical decisions

> ⚠ **PROPOSED — pending sign-off Phuc DN**. Trả lời TẤT CẢ "Plan checklist" trong ROADMAP.md cho M4.

### Decision 1: CI provider
- **Question:** GitHub Actions / Jenkins / CircleCI?
- **Options considered:**
  - GH Actions: free tier rộng (2000 min/month private), native YAML, ecosystem reusable actions, integrated với gh CLI, đã được spec §7.2 đề xuất.
  - Jenkins: self-host overhead, không phù hợp single-eng project.
  - CircleCI: free tier hẹp hơn GH; thêm vendor.
- **Decision (proposed):** **GitHub Actions**.
- **Rationale:** Phù hợp solo + spec example đã GH Actions; free tier rộng; secret + status check + branch protection native.

### Decision 2: Repo hosting + naming (signed-off Q1)
- **Decision:** **`github.com/santete/appium-automation-testing`, default `main`**.
- **Rationale:** Q1 sign-off Phuc DN 2026-04-28.

### Decision 3: Device farm (signed-off Q2)
- **Question:** BrowserStack / Sauce Labs / Firebase Test Lab? Hay không wire?
- **Decision:** **KHÔNG wire device farm M4**. Smoke E2E giữ local-dev real device. `wdio.bs.ts` + `wdio.sauce.ts` config-driven skeleton stub cho M5+ swap.
- **Rationale:** Q2 sign-off Phuc DN — "chưa cần device farm, ưu tiên real device dev, config-driven nếu cần thiết". Tradeoff: smoke E2E manual gate trong PR review thay vì auto CI block; chấp nhận để M4 ship gọn.

### Decision 4: iOS scope
- **Question:** M4 include iOS hay defer?
- **Options considered:**
  - Include M4: device farm enable iOS without local Mac, nhưng phải build .ipa (cần Xcode + signing — mượn Mac), thêm `wdio.bs.ios.ts`, double sharding count.
  - Defer M5/M6: focus Android end-to-end first.
- **Decision (proposed):** **Defer M5+** (out of scope). 
- **Rationale:** M4 mục tiêu chính là CI pipeline reliability; thêm iOS scope creep. Đợi M4 stable thì M5/M6 add iOS với spare capacity.

### Decision 5: Sharding strategy (signed-off Q7 — revised post-Q2)
- **Decision:** **Không sharding M4**. Single CI job; suite hiện ~30s.
- **Rationale:** Sharding cho smoke E2E không applicable (defer device farm); non-device tier tổng < 1 phút → sharding overengineering. Activate khi suite > 5 phút (M5/M6).

### Decision 6: Secret management
- **Question:** GitHub Secrets / Vault / AWS Secrets Manager?
- **Options considered:**
  - GH Secrets: native GH Actions, free, encrypted at rest, exposed via env in workflow.
  - HashiCorp Vault: self-host overhead, không justify M4 scope.
- **Decision (proposed):** **GitHub Secrets**. Naming convention: `BS_USER`, `BS_KEY`, `SLACK_WEBHOOK_PR`, `SLACK_WEBHOOK_QA`, `GH_PAGES_TOKEN` (nếu cần PAT).
- **Rationale:** Native + đủ cho M4; rotate qua GH UI.

### Decision 7: Branch protection scope
- **Question:** main only / main + develop?
- **Options considered:**
  - Main only: project hiện 1 branch flow.
  - Main + develop: multi-flow project (M4 chưa cần).
- **Decision (proposed):** **Main only**. Required check: `smoke / shard-1`, `smoke / shard-2`. Required reviews: 1.
- **Rationale:** Single-eng project, develop branch overhead; có thể add later.

### Decision 8: Allure publish strategy
- **Question:** GH Pages / S3 / Allure TestOps?
- **Options considered:**
  - **GH Pages**: free, native với GH Actions (`peaceiris/actions-gh-pages`), unlimited static hosting. URL stable `<user>.github.io/<repo>/<run-id>/`.
  - S3: cost + bucket setup overhead.
  - Allure TestOps: paid, defer M5.
- **Decision (proposed):** **GH Pages**. Per-run subfolder retention 30 ngày (rolling cleanup script).
- **Rationale:** Zero cost + integrated; clean rotation đủ M4.

### Decision 9: Slack notification
- **Question:** Workspace + channels?
- **Options considered:**
  - Cần ít nhất 2 channel theo spec §7.6: `#pr-failures`, `#qa-alerts`.
  - Thêm `#qa-leads` cho flaky-rate alert defer M5.
- **Decision (proposed):** **2 channels M4: `#pr-failures` + `#qa-alerts`**, mỗi channel 1 incoming webhook.
- **Rationale:** Spec match; flaky-rate channel defer M5.
- **⚠ Cần anh setup**: workspace + 2 channel + 2 webhook URL → add vào GH Secrets.

### Decision 10: Quarantine deadline policy
- **Question:** Bao lâu trước khi force fix?
- **Options considered:**
  - 1 tuần: aggressive, áp lực fix nhanh nhưng dễ miss.
  - 2 tuần: spec không đề cập explicit; reasonable cho 1-eng team.
  - 1 tháng: relaxed, dễ accumulate debt.
- **Decision (proposed):** **2 tuần default deadline + 1 tuần grace (extend tối đa 1 lần qua PR review)**. Beyond that → CI fail.
- **Rationale:** Force fix trước khi quarantine quên; grace cho real blocker.

### Decision 11: D4 real-device APK source (signed-off Q6)
- **Decision:** **Build minimal Kotlin Android app** trong `apps/test-debuggable-src/`. Gradle wrapper checked in. Build local qua `./gradlew assembleDebug` (không CI build vì M4 không wire Android SDK trên CI).
- **Rationale:** Q6 sign-off + Q2 device farm defer → APK build + verify đều local. Phuc verify thủ công 1 lần đóng D4. M5+ wire CI build APK + device farm test.

### Decision 12: WDIO Mocha tagging cho quarantine
- **Question:** Tag mechanism — Mocha pending / mocha-grep / custom hook?
- **Options considered:**
  - Mocha `it.skip()` với annotation comment: not enforceable.
  - `mocha-grep` `--grep '@quarantine' --invert`: built-in, lightweight.
  - Custom Mocha hook đọc quarantine.yaml + dynamic skip: heavier nhưng deadline-aware.
- **Decision (proposed):** **Custom hook**: `tests/_hooks/quarantine.ts` đọc `docs/quarantine.yaml`, match `test.fullTitle()` với `test_id`; nếu deadline future → `this.skip()`; nếu past → `throw` để CI fail.
- **Rationale:** Single source-of-truth (YAML), deadline enforcement automatic.

> Mỗi decision sau khi sign-off phải copy vào `Decisions log` trong `ROADMAP.md`.

## 5. Task breakdown

| # | Task | Deliverable file | Estimate | Status | Skill |
|---|------|------------------|----------|--------|-------|
| 1 | Repo bootstrap: `git init`, .gitignore review, initial commit M1-M3 history collapse, push `santete/appium-automation-testing` | `.git`, GH repo | 0.5h | 🟢 | — |
| 2 | README + CI badges + PR template | `README.md`, `.github/PULL_REQUEST_TEMPLATE.md` (smoke local checklist) | 0.5h | 🟢 | — |
| 3 | Device farm config-driven stub | `src/config/wdio.bs.ts`, `wdio.sauce.ts`, `.env.example` (BS_USER/BS_KEY placeholder) | 0.7h | 🟢 | test-implement |
| 4 | CI workflow `ci.yml` (PR + push to main) — typecheck + lint + unit + integration + api | `.github/workflows/ci.yml` | 1.5h | 🟢 | — |
| 5 | Regression workflow (cron 2AM + manual dispatch) — full + `ALLOW_NETWORK_INTEGRATION=1` | `.github/workflows/regression.yml` | 1h | 🟢 | — |
| 6 | Allure publish reusable composite action — collect integration Allure, deploy GH Pages | `.github/actions/publish-allure/action.yml` | 1h | ⬜ | — |
| 7 | Slack notification reusable composite (PR fail + nightly fail) | `.github/actions/notify-slack/action.yml` | 0.7h | ⬜ | — |
| 8 | Quarantine YAML + Zod schema + custom Mocha hook | `docs/quarantine.yaml`, `tests/_hooks/quarantine.ts`, schema | 1h | 🟢 | test-implement |
| 9 | Quarantine deadline check script + CI step | `scripts/check-quarantine.cjs` | 0.5h | ⬜ | — |
| 10 | Branch protection setup script | `scripts/setup-branch-protection.sh` (gh api PUT) | 0.5h | ⬜ | — |
| 11 | Pipeline duration baseline tracker | `scripts/append-duration.cjs` + CI step | 0.7h | ⬜ | — |
| 12 | actionlint workflow self-lint | `.github/workflows/actionlint.yml` | 0.5h | 🟢 | — |
| 13 | Build minimal debuggable test APK source | `apps/test-debuggable-src/` Android Studio project (Kotlin, Gradle wrapper, 1 Activity + SharedPreferences) | 2h | ⬜ | test-data-setup |
| 14 | Local APK build script | `scripts/build-test-apk.cjs` wrap `./gradlew assembleDebug` | 0.3h | ⬜ | test-data-setup |
| 15 | **D4 carry-over**: real-device integration spec | `tests/integration/state-checker-mobile-real.spec.ts` (local-dev only, requires `RUN_REAL_DEVICE=1` gate) | 1h | ⬜ | assertion-contract |
| 16 | Smoke local verify gate documentation | `docs/runbook-pr-merge-gate.md` | 0.3h | ⬜ | — |
| 17 | Acceptance runbook M4 | `docs/runbook-M4-acceptance.md` (9 sub-points) | 0.5h | ⬜ | — |
| 18 | M4 acceptance run (9 sub-points) | (verification) | 1.5h | ⬜ | test-validate |
| 19 | Update ROADMAP + plan closure | `ROADMAP.md`, this file | 0.3h | ⬜ | — |

**Total estimate:** ~14 hours (~1.5-2 ngày làm việc tập trung). Buffer 50% cho GH Pages + Slack webhook setup quirks → ~3 tuần realistic (target 2026-04-29 → 2026-05-20).

## 6. Dependencies

### Upstream (must finish first)
- [x] M3 done — account pool + global hook + smoke spec stable.
- [ ] GitHub repo `santete/appium-automation-testing` created + access (Phuc).
- [ ] Slack workspace + 2 channel (`#pr-failures`, `#qa-alerts`) + 2 webhook URL (Phuc).
- [ ] Android dev device available cho D4 verify (USB debug, ADB connected).

### Downstream (block these)
- M5 cần CI runs accumulate 2-4 tuần để build dashboard trend.

### External dependencies
- GitHub Pages enabled trên repo settings (deploy Allure).
- Slack Incoming Webhook app installed trong workspace + 2 channel webhook tạo.
- Android SDK + Gradle local cho build debuggable test APK (Phuc dev machine — đã có, M3 verified).
- Android dev device USB-connect cho D4 verify (Phuc dev workstation).

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Smoke E2E "honor system" gate dễ skip (devs forget local verify) | H | M | PR template checkbox enforced bởi reviewer; document trong runbook + CLAUDE.md "merge gate". M5 wire device farm để auto. |
| GH Pages deploy chậm (>5 phút) làm regression workflow timeout | L | M | Increase `timeout-minutes: 30`; fallback artifact-only nếu Pages fail. |
| Slack webhook rotate / revoke giữa milestone | L | M | Documented trong runbook; secrets rotate plan ghi nhật ký. |
| Debuggable test APK build flaky local (Gradle wrapper bootstrap chậm) | M | L | Pin AGP version + checked-in `gradle/wrapper/gradle-wrapper.jar`; cache `~/.gradle/caches`. |
| Branch protection block emergency fix | L | M | Document override path (admin force-merge) trong runbook; only Phuc admin. |
| Quarantine custom hook conflict với Mocha root hook plugin (M3) | M | L | Composition test trong unit suite; quarantine hook chạy trước global lease hook (skip throw before lease). |
| iOS scope creep mid-milestone | M | M | Strict out-of-scope; nếu user cần iOS preview → mini-spike M5. |
| Initial commit history M1-M3 lost: chưa git → tất cả file untracked | H | L | Single initial commit "M1+M2+M3 baseline" với meaningful message; ROADMAP/plan files giữ history thực. |
| `ALLOW_NETWORK_INTEGRATION=1` trong nightly fail vì httpbin.org down | L | M | `axios-retry` 3 lần với exponential backoff; quarantine entry tự động nếu fail rate > 10%. |
| Device farm config-driven stub bị dead code lâu (M5 lùi) → drift | M | L | Stub có comment "M5 unblock" + Plan-revisions phải log nếu defer thêm; M5 plan check stub trước khi swap. |

## 8. Test plan (verify deliverables)

- [ ] Unit test cho `quarantine` parser + deadline check (Zod schema, past/future/missing entry).
- [ ] Unit test cho `check-quarantine.cjs` (mock filesystem).
- [ ] Local smoke với BS qua `npm run test:smoke -- --hostname=hub.browserstack.com` (manual sanity trước CI wire).
- [ ] CI smoke trên test PR: 2 shards parallel + Allure artifact + Slack notify (test webhook trước).
- [ ] Forced-fail PR → status check RED + Slack PR-failures notified.
- [ ] Cron trigger (manual `workflow_dispatch`) → regression workflow + Pages deploy.
- [ ] Quarantine future-deadline → skip; past-deadline → CI fail.
- [ ] D4 real-device spec trên BS → state assertion PASS với debuggable APK.

## 9. Rollback plan

Nếu phải hủy giữa chừng:
- Revert workflows: xóa `.github/workflows/*.yml` (giữ git history).
- Disable branch protection qua `gh api` (idempotent).
- Local-only fallback: smoke tiếp tục chạy local emulator (M3 path), không CI block merge.
- D4 carry-over → carry-over M5 nếu không kịp build APK (document trong Debt log).
- Slack webhook revoke + remove secrets.

## 10. Sign-off checklist

- [x] Goal + Done criteria khớp ROADMAP.md
- [x] Scope rõ ràng (in/out)
- [x] **12 decisions §4 confirmed** — Q1 (santete repo), Q2 (no device farm M4, config-driven stub), Q3-Q12 OK per Phuc DN 2026-04-28
- [x] Task breakdown 19 tasks + estimate
- [x] Dependencies xác định (GH repo + Slack + dev device cho D4)
- [x] Risks đã thảo luận (10 risks updated cho non-device-farm scope)
- [x] Stakeholder Phuc DN approve — sign-off 2026-04-28

### Q&A trace

| # | Question | Phuc DN answer 2026-04-28 |
|---|----------|---------------------------|
| Q1 | GH repo location? | `github.com/santete/appium-automation-testing` |
| Q2 | Device farm? | **KHÔNG wire M4** — real device dev, config-driven stub cho M5+ |
| Q3 | iOS defer M5+? | OK |
| Q4 | Slack webhooks? | OK (`#pr-failures`, `#qa-alerts`) — Phuc tạo + add secrets |
| Q5 | Quarantine 2w + 1w grace? | OK |
| Q6 | D4 APK = minimal Kotlin app? | OK |
| Q7 | Sharding? | OK — bỏ sharding (single CI job) post-Q2 |
| Q8 | Secret naming? | OK |
| Q9 | GH Pages Allure 30 ngày? | OK |
| Q10 | Branch protection main only? | OK |
| Q11 | Mac access cho iOS sau? | Note cho M5 plan |
| Q12 | Schedule 2026-04-29 → 2026-05-20? | OK |

## 11. Status updates (weekly)

| Date | Update | Blockers |
|------|--------|----------|
| 2026-04-28 | Plan v0.1 draft. 12 decisions proposed, 12 open questions surface to Phuc DN cho sign-off. Status → 📝 Planning. | Pending stakeholder sign-off (Q1-Q12). |
| 2026-04-28 | Phuc DN sign-off: Q1 = `santete/appium-automation-testing`, Q2 = KHÔNG wire device farm M4 (config-driven stub cho M5+), Q3-Q12 OK. Plan revised v0.1 → v1.0: drop BS wire-up, drop sharding, smoke E2E giữ local-dev với PR template gate. Status → 🔵 Plan ready. | None. Cần Phuc setup GH repo + Slack webhooks trước Task 4-7. |
| 2026-04-28 | **Task 1 🟢** — repo bootstrap. `git init -b main` + `.gitignore` revise (add `tmp/`, `.gradle/`, `**/build/`, `local.properties`, `.claude/settings.local.json`, `.claude/scheduled_tasks.lock`); 80 files staged (no `.env.local` / `node_modules/` / APK leak); single squashed commit `e0eb4b9` "M1+M2+M3 baseline"; `origin` = `https://github.com/santete/appium-automation-testing.git`; `git push -u origin main` SUCCESS. Repo public at https://github.com/santete/appium-automation-testing. Status → 🟡 In progress (Task 2-19 next). | Cần Phuc tạo Slack workspace + 2 channel + 2 webhook (block Task 7), enable GH Pages trong repo settings (block Task 6). |
| 2026-04-28 | **Task 2 + 3 🟢** — README CI/Allure badge + `.github/PULL_REQUEST_TEMPLATE.md` (auto CI gate + smoke local honor-system + multi-layer assertion + quarantine + plan-before-execute checklists). Config-driven stubs `src/config/wdio.bs.ts` + `wdio.sauce.ts` ship với fail-fast guard (throw nếu BS_*/SAUCE_* env empty) — M5+ activation chỉ cần fill creds + uncomment `bstack:options`/`sauce:options` block. `.env.example` + `src/config/index.ts` Zod schema thêm SAUCE_* placeholders. Verify: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` 54/54 ✅. | None — Task 4 (CI workflow) sẵn sàng. |
| 2026-04-28 | **Task 4 + 5 🟢** — `.github/workflows/ci.yml`: PR + push to main trigger, single Linux job `verify` (typecheck + lint + unit + integration + api), `concurrency: cancel-in-progress` để hủy run cũ, env block set Zod-required vars (ANDROID_DEVICE_NAME=ci-stub, APP_PATH placeholder), `ALLOW_NETWORK_INTEGRATION=''` (gated tests skip), Allure artifact retention 7 ngày, timeout 10min. `.github/workflows/regression.yml`: cron `0 2 * * *` UTC + `workflow_dispatch`, `ALLOW_NETWORK_INTEGRATION='1'` (real httpbin), Allure artifact 30 ngày, timeout 30min. GH Pages deploy + Slack notify steps placeholder commented (uncomment khi Task 6 + 7 ship — chờ Phuc enable Pages + tạo webhooks). | Task 6 (Allure GH Pages composite action) cần Phuc enable Settings → Pages. Task 7 (Slack composite) cần Phuc tạo workspace + 2 webhook URLs. |
| 2026-04-28 | **Task 8 + 12 🟢** — Quarantine mechanism (`src/utils/quarantine/{schema,loader}.ts` + `tests/_hooks/quarantine.ts` + `docs/quarantine.yaml` + 21 unit tests). Zod schema validate `{test_id, reason≥10, added, deadline, owner}` + 2 refinements (deadline ≥ added, deadline ≤ added + 21 ngày = 14 default + 7 grace). Loader: file missing/null YAML → empty (graceful), invalid → throw với issue path. Mocha root hook đọc YAML init, beforeEach match `fullTitle()` → future deadline `this.skip()`, past deadline throw error message với owner + reason + max-extend hint. Hook wired vào tất cả mocharc (unit/integration/api) + WDIO configs (local/staging/bs/sauce) — quarantine FIRST trong require list để skip-before-lease tránh leak AccountPool slot. Verify: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` 75/75 ✅ (54 + 21 quarantine), `npm run test:integration` ✅, `npm run test:api` ✅. Task 12: `.github/workflows/actionlint.yml` self-lint dùng `docker://rhysd/actionlint`, trigger paths-filtered cho `.github/workflows/**`, 5min timeout, concurrency cancel-in-progress. | Task 9 (deadline check script CI gate) sẵn sàng next. Task 6+7 vẫn block chờ Phuc Pages + Slack. |

## 12. Plan revisions

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| 2026-04-28 | v0.1 → v1.0: Q2 sign-off "không wire device farm" → drop BS Task (cũ Task 3-4-8), thay bằng config-driven stub `wdio.bs.ts`/`wdio.sauce.ts`. Smoke E2E moved out of CI scope → PR template "smoke local PASS" checkbox gate. Sharding dropped (single CI job, suite ~30s). Done criteria reduced từ 8 sub-points → 9 sub-points (revised: CI gate + nightly + Slack + Allure + quarantine + branch protection + D4 local + smoke local gate + farm stub). Total estimate giảm ~17h → ~14h. | Q1+Q2 sign-off changes scope; Q3-Q12 unchanged. Bundled into v1.0 sign-off. | No — đây là sign-off đầu tiên. |

## 13. Closure

_(Pending execution.)_
