# M4 — CI/CD Integration

> Implementation plan cho milestone M4. Workflow đầy đủ xem `docs/plans/README.md`.

## Metadata

| Field | Value |
|-------|-------|
| Milestone ID | M4 |
| Spec section | `automation_testing_requirement.md` §7 + §11 Phase 4 |
| Status | 🟡 In progress (v1.1 revised 2026-04-28; Task 1+2+3+4+5+8+9+12/19 done 2026-04-28; Task 6+7+11 deferred M5) |
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

> PR mở → CI gate (typecheck + lint + unit + integration + api + quarantine deadline check) chạy **< 5 phút**, fail **block merge** (branch protection); D4 real-device verify pass trên dev device; smoke E2E manual verify gate (PR description checklist); Allure xem local từ artifact zip; **không wire device farm + Slack + GH Pages — defer M5**.

**Acceptance test cụ thể (post-revision v1.1, 2026-04-28 — solo-local focus):**
1. **Repo + CI bootstrapped**: codebase đã ở `github.com/santete/appium-automation-testing`. Default branch `main`. Branch protection minimal: required check `ci / verify`, **không require review** (solo dev).
2. **CI gate trên PR**: PR open → workflow `ci.yml` chạy typecheck + lint + unit (75) + integration (8 + 2 gated) + api (1) + quarantine deadline check, tổng wall < 5 phút, all pass; Allure artifact (integration only) uploaded.
3. **CI fail block merge**: PR với forced break → status check RED, "Merge" button disabled bởi branch protection.
4. **Nightly regression**: cron `0 2 * * *` (UTC) → workflow `regression.yml` chạy full non-device suite + `ALLOW_NETWORK_INTEGRATION=1`; duration < 10 phút; Allure artifact 30 ngày retention. **Xem report local: download artifact zip → unzip → mở `index.html`**.
5. **Quarantine list**: `docs/quarantine.yaml` schema `{ test_id, reason, added, deadline, owner }`; Mocha hook future-deadline → skip / past → throw; **CI step `scripts/check-quarantine.cjs` enforce schema validation + verify mọi entry deadline ≤ added + 21 ngày** (catch misuse trước runtime).
6. **D4 real-device repay (local-dev gate)**: build debuggable test APK trong `apps/test-debuggable-src/`; integration spec `tests/integration/state-checker-mobile-real.spec.ts` chạy LOCAL trên dev Android device qua `wdio.local.ts`; `mobile:executeScript` backend lookup shared_prefs → state assertion PASS. Phuc verify thủ công 1 lần.
7. **Smoke local verify gate**: PR template checklist "[ ] `npm run test:smoke` PASS local + evidence link". Reviewer enforce gate. Documented trong `docs/runbook-pr-merge-gate.md`.

**~~5 sub-points cũ~~ (defer M5)**: Slack notify (`#pr-failures`/`#qa-alerts`), Allure GH Pages deploy, pipeline duration baseline tracker, device farm wire-up (vẫn giữ stub Task 3).

## 3. Scope

### In scope (post-revision v1.1, 2026-04-28 — solo-local focus)
- **Repo bootstrap**: `git init` + push `santete/appium-automation-testing`. ✅ Done Task 1.
- **CI workflow** (`.github/workflows/ci.yml`): typecheck + lint + unit + integration + api + quarantine deadline check. Single Linux runner. ✅ Done Task 4 (quarantine check Task 9 còn).
- **Regression workflow** (`.github/workflows/regression.yml`): cron 2AM UTC + manual dispatch; full + `ALLOW_NETWORK_INTEGRATION=1`; **Allure artifact 30 ngày — xem local từ zip download**. ✅ Done Task 5.
- **Branch protection (minimal)**: enable trên `main` qua `gh api`; require check `ci / verify`; **không require review** (solo). Force-push blocked.
- **Quarantine mechanism**: schema + Zod + Mocha hook (`tests/_hooks/quarantine.ts`) deadline-aware. ✅ Done Task 8. **CI deadline check script** (Task 9) còn.
- **Smoke local verify gate**: PR template checklist + runbook documentation. PR template ✅ Done Task 2; runbook (Task 16) còn.
- **Device farm config-driven stub**: `wdio.bs.ts` + `wdio.sauce.ts` skeleton fail-fast guard. ✅ Done Task 3.
- **D4 real-device verification (carry-over M3 — local-dev only)**:
  - `apps/test-debuggable-src/` — minimal Kotlin Android app, Gradle wrapper, 1 Activity write SharedPreferences `m4_state_test_key=ok`.
  - `scripts/build-test-apk.cjs` wrap `./gradlew assembleDebug`.
  - `tests/integration/state-checker-mobile-real.spec.ts` — LOCAL trên dev Android device; install APK, write pref, lookup qua `mobile:executeScript` → assert match. Phuc verify thủ công 1 lần.

### Out of scope (explicit — defer M5+)
- ❌ **Slack notification** — defer M5 per 2026-04-28 revision ("kênh nhận thông tin cảnh báo này nọ setup sau"). M4 dùng Actions tab native notification (anh tự check).
- ❌ **Allure host (GH Pages / Vercel / S3)** — defer M5 per 2026-04-28 revision (Enterprise org block GH Pages; "dashboard chưa share link được thì xem local"). M4 dùng artifact zip download.
- ❌ **Pipeline duration baseline tracker** — defer M5; M5 dashboard mới cần CSV/Gist data này.
- ❌ **Device farm wire-up (BrowserStack/Sauce Labs)** — defer M5+ per Q2.
- ❌ **Smoke E2E trong CI** — local-dev only M4.
- ❌ **Sharding** — single CI job đủ.
- ❌ **iOS support** — defer M5/M6.
- ❌ **Self-hosted CI runner** — defer M5+.
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

### Decision 7: Branch protection scope (revised v1.1, 2026-04-28)
- **Question:** main only / main + develop? Required reviews?
- **Options considered:**
  - Main only: project hiện 1 branch flow.
  - Main + develop: multi-flow project (M4 chưa cần).
  - Required review 1: enforce code review process.
  - Không require review: solo dev không có ai khác review, blocking CI workflow.
- **Decision v1.0 (signed-off):** Main only + required check + 1 review.
- **Decision v1.1 (revised 2026-04-28):** **Main only + required check `ci / verify` + KHÔNG require review** (solo dev: no reviewer available, "1 review required" sẽ block forever khi anh tự PR). Force-push blocked giữ nguyên.
- **Rationale:** "tập trung xử lý cho hoàn thiện sản phẩm có thể chạy solo ở local" — adapt branch protection cho solo workflow. M5+ khi có team có thể add review requirement.

### Decision 8: Allure publish strategy (revised v1.1, 2026-04-28 — DEFER M5)
- **Question:** GH Pages / S3 / Allure TestOps / Vercel?
- **Options considered v1.0:**
  - **GH Pages**: free, native, URL stable. Selected v1.0.
  - S3: cost + bucket setup overhead.
  - Allure TestOps: paid, defer M5.
- **Decision v1.0 (signed-off):** GH Pages + 30-day retention.
- **Decision v1.1 (revised 2026-04-28):** **DEFER M5 — không host Allure ở M4. Xem local từ artifact zip download.**
- **Trigger event:** GH Pages bị block trên Enterprise org (anh check 2026-04-28). Vercel alternative cũng được consider nhưng "dashboard chưa share link được thì xem local" — solo dev không cần share-able link.
- **M4 path:** Allure artifact upload trong `regression.yml` (retention 30 ngày), download zip → unzip → mở `index.html` local. ~30s friction acceptable.
- **M5 revisit:** khi có team / cần share link Slack-PR / có dashboard tool (Grafana/ReportPortal). Options khả dĩ M5: Vercel (Enterprise-friendly), self-host static, dashboard tool tích hợp.

### Decision 9: Slack notification (revised v1.1, 2026-04-28 — DEFER M5)
- **Question:** Workspace + channels?
- **Decision v1.0 (signed-off):** 2 channels `#pr-failures` + `#qa-alerts`, mỗi channel 1 incoming webhook.
- **Decision v1.1 (revised 2026-04-28):** **DEFER M5 — không wire Slack notify M4.**
- **Trigger event:** "kênh nhận thông tin cảnh báo này nọ setup sau, tập trung xử lý cho hoàn thiện sản phẩm có thể chạy solo ở local" (Phuc DN 2026-04-28).
- **M4 path:** GitHub Actions native notification (failure email từ GH, plus anh tự check Actions tab khi cần).
- **M5 revisit:** khi có team / có on-call / cần Slack-channel triage. Workspace + webhook setup chỉ làm khi có nhu cầu thật.

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
| 6 | ~~Allure publish reusable composite action~~ — **DEFER M5** (Enterprise block GH Pages; xem local từ artifact zip) | ~~`.github/actions/publish-allure/action.yml`~~ | — | 🔵 Deferred | — |
| 7 | ~~Slack notification reusable composite~~ — **DEFER M5** (Actions tab native notification đủ solo) | ~~`.github/actions/notify-slack/action.yml`~~ | — | 🔵 Deferred | — |
| 8 | Quarantine YAML + Zod schema + custom Mocha hook | `docs/quarantine.yaml`, `tests/_hooks/quarantine.ts`, schema | 1h | 🟢 | test-implement |
| 9 | Quarantine deadline check script + CI step | `scripts/check-quarantine.cjs` | 0.5h | 🟢 | — |
| 10 | Branch protection setup script (minimal — solo, không require review) | `scripts/setup-branch-protection.sh` (gh api PUT) | 0.2h | ⬜ | — |
| 11 | ~~Pipeline duration baseline tracker~~ — **DEFER M5** (M5 dashboard mới consume data) | ~~`scripts/append-duration.cjs`~~ | — | 🔵 Deferred | — |
| 12 | actionlint workflow self-lint | `.github/workflows/actionlint.yml` | 0.5h | 🟢 | — |
| 13 | Build minimal debuggable test APK source | `apps/test-debuggable-src/` Android Studio project (Kotlin, Gradle wrapper, 1 Activity + SharedPreferences) | 2h | ⬜ | test-data-setup |
| 14 | Local APK build script | `scripts/build-test-apk.cjs` wrap `./gradlew assembleDebug` | 0.3h | ⬜ | test-data-setup |
| 15 | **D4 carry-over**: real-device integration spec | `tests/integration/state-checker-mobile-real.spec.ts` (local-dev only, requires `RUN_REAL_DEVICE=1` gate) | 1h | ⬜ | assertion-contract |
| 16 | Smoke local verify gate documentation | `docs/runbook-pr-merge-gate.md` | 0.3h | ⬜ | — |
| 17 | Acceptance runbook M4 | `docs/runbook-M4-acceptance.md` (9 sub-points) | 0.5h | ⬜ | — |
| 18 | M4 acceptance run (9 sub-points) | (verification) | 1.5h | ⬜ | test-validate |
| 19 | Update ROADMAP + plan closure | `ROADMAP.md`, this file | 0.3h | ⬜ | — |

**Total estimate:** ~14h v1.0 → **~10h v1.1** (defer Task 6+7+11 = drop ~2.4h ship effort + drop Slack/Pages setup ~3-4h). Realistic schedule: 2026-04-28 → ~2026-05-08 (~1.5 tuần) post-revision.

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
| 2026-04-28 | **Plan revision v1.0 → v1.1 — solo-local focus.** Defer Task 6 (Allure host: GH Pages bị Enterprise block, Vercel không justify cho solo dev), Task 7 (Slack: kênh thông báo setup sau), Task 11 (pipeline duration: M5 dashboard mới cần) sang M5. Decision 7 revised: drop "1 review required" cho branch protection (solo workflow không có reviewer). Done criteria 9 sub-points → 7 (xóa Slack notify + Allure host + duration baseline; giữ CI + branch protection + quarantine deadline check + D4 + smoke gate + farm stub). Estimate ~14h → ~10h. M4 còn lại: Task 9 (quarantine CI), Task 10 (branch protection minimal), Task 13-15 (D4 Kotlin APK + spec), Task 16 (smoke runbook), Task 17-19 (acceptance + closure). | None — focus task quan trọng để framework chạy solo local. |
| 2026-04-28 | **Task 9 🟢** — Quarantine deadline check CI gate. `scripts/check-quarantine.cjs` reuse `loadQuarantine` qua `ts-node/register/transpile-only` (single source of truth, không duplicate schema validation; transpile-only skip type check vì CI chạy `npm run typecheck` riêng). 3 path verify: (a) empty entries → exit 0 PASS, (b) past-deadline entries → exit 1 FAIL với output owner/reason/deadline, (c) schema invalid → exit 1 FAIL với issue path. Wired vào `ci.yml` + `regression.yml` step "Quarantine deadline check" sau Lint trước Unit. `package.json` thêm script `npm run check:quarantine`. Cũng update `regression.yml` xoá Task 6/7 placeholder comments → ghi note plan v1.1 defer M5. | None — Task 10 (branch protection minimal), Task 13-15 (D4 Kotlin APK) tiếp theo. |

## 12. Plan revisions

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| 2026-04-28 | v0.1 → v1.0: Q2 sign-off "không wire device farm" → drop BS Task (cũ Task 3-4-8), thay bằng config-driven stub `wdio.bs.ts`/`wdio.sauce.ts`. Smoke E2E moved out of CI scope → PR template "smoke local PASS" checkbox gate. Sharding dropped (single CI job, suite ~30s). Done criteria reduced từ 8 sub-points → 9 sub-points (revised: CI gate + nightly + Slack + Allure + quarantine + branch protection + D4 local + smoke local gate + farm stub). Total estimate giảm ~17h → ~14h. | Q1+Q2 sign-off changes scope; Q3-Q12 unchanged. Bundled into v1.0 sign-off. | No — đây là sign-off đầu tiên. |
| 2026-04-28 | v1.0 → v1.1 — **defer Task 6 (Allure host) + Task 7 (Slack) + Task 11 (duration tracker) sang M5**. Done criteria 9 sub-points → 7 sub-points. Branch protection (Decision 7) drop "1 review required" (solo workflow). Estimate ~14h → ~10h. Schedule mới: 2026-04-28 → ~2026-05-08. | (a) GH Pages bị Enterprise org block (Phuc check 2026-04-28); Vercel alternative consider nhưng solo dev không cần share-able link → "dashboard chưa share link được thì xem local". (b) "kênh nhận thông tin cảnh báo này nọ setup sau, tập trung xử lý cho hoàn thiện sản phẩm có thể chạy solo ở local". (c) Pipeline duration tracker chỉ M5 dashboard mới consume. | No — defer scope ra ngoài, không thêm gì mới. Revision logged trong Decisions log + ROADMAP. |

## 13. Closure

_(Pending execution.)_
