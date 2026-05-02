# Runbook — Operational Process (vận hành sản phẩm hàng ngày)

> **Đối tượng đọc:** Phuc DN (solo operator) + future team member onboard sau M6.
> **Mục tiêu:** mở runbook này là biết hôm nay làm gì, không cần đoán. Từ "test fail lúc 3h sáng" đến "PRD mới về, viết test thế nào".
> **Khi nào update file này:** sau mỗi lần tìm ra workflow mới hoặc gặp issue lặp lại lần thứ 2.

**Pre-req:** đã đọc `README.md` + `docs/runbook.md` (setup environment).

---

## TL;DR — 1 page cheat sheet

| Tình huống | Lệnh / Tài liệu |
|------------|----------------|
| Mỗi sáng kiểm tra dashboard | Mở `http://127.0.0.1:3000/d/m6-kpi-sustained` |
| Trước commit code | `npm run lint && npm run typecheck && npm run test:unit` |
| Trước push branch | `npm run test:smoke` (1 device local) |
| Test fail trong CI | Skill `failure-rca` → route theo §6 spec |
| Locator broken | Wait self-heal-pr.cjs PR (auto, ~ 1 ngày), review + merge |
| Cần thêm test mới | Workflow §4 dưới đây — KHÔNG skip Step 2 (Assertion Contract) |
| Báo lỗi flaky | Commit message convention `fix(flaky): <test_id> ...` (Decision 6) |
| Refresh ROI weekly | `node scripts/maintenance-cost.cjs && node scripts/analytics-trend.cjs` |
| Release smoke gate | `npm run test:smoke && npm run test:smoke:20x` |
| Release device matrix gate | `npm run test:bs:matrix -- --sequential` |
| KPI sustained check | `node scripts/check-kpi-window.cjs` (CI auto-run nightly) |

---

## 1. Daily ops (mỗi sáng / mỗi PR)

### 1.1 Morning check (5 phút)

1. Mở Grafana dashboard `m6-kpi-sustained`:
   - Panel 1-4 (auto-gated KPI) — verify all green.
   - Panel 11 "Green days / 14" — đếm ngày green, ≥ 10 thì track to KPI sustain target.
2. Mở GH Actions tab → check overnight regression (cron 02:00 UTC ≈ 09:00 ICT):
   - All steps green? Nếu fail → đi tiếp §1.4.
3. Mở GH Issues filter `label:ci-fail-auto` → có Issue mới do `notify-fail.yml` tạo? Đi tiếp §5 RCA workflow.

### 1.2 Pre-commit (mỗi commit)

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Nếu fail → fix trước khi commit. **KHÔNG dùng `--no-verify`** (CLAUDE.md ngầm ban skip hook).

### 1.3 Pre-push (branch local → remote)

```bash
npm run test:smoke   # 1 device local, ~3 phút
```

Nếu chạm Page Object hoặc utils core → thêm:

```bash
npm run test:integration   # ~2 phút
npm run test:api           # ~1 phút
```

### 1.4 PR pipeline fail trong < 10 phút

Quy trình **mặc định**:

1. Mở PR check tab → click failed step → đọc log tail.
2. Identify failure layer:
   - Lint/typecheck → fix syntax, push lại.
   - Unit test → đọc spec, fix logic, push lại.
   - Integration/api → check `tmp/account-pool.state.json` lock leak; remove orphan lock + push lại.
   - Smoke E2E → đi tiếp §5 RCA workflow.
3. Nếu nghi flaky (re-run pass trong PR queue) → KHÔNG retry blindly. Run skill `failure-rca` để classify trước khi quyết định quarantine.

---

## 2. Weekly ops (mỗi thứ 2)

### 2.1 KPI review (15 phút)

```bash
docker compose -f infra/observability/docker-compose.yaml ps   # ensure stack up
xdg-open http://127.0.0.1:3000/d/m6-kpi-sustained
```

Đọc 12 panel, đặc biệt:
- **Panel 9** (Pass rate trend): slope đi xuống → đi tiếp §2.4 trend analysis.
- **Panel 11** (Green days/14): < 10 → milestone sustain at risk.
- **Panel 12** (Daily breakdown): tìm ngày spike fail → cross-reference git log + RCA history.

### 2.2 Maintenance cost refresh

```bash
node scripts/maintenance-cost.cjs
```

Output: `reports/analytics/maintenance-cost.json`. Mở file, check:
- `total_hours` < 4h/sprint → tracking ổn.
- `missing_test_id_count` > 0 → có commit không follow convention `fix(flaky): <test_id> ...`. Phuc cảnh báo bản thân (hoặc team future) update commit message style.

### 2.3 Trend forecast

```bash
node scripts/analytics-trend.cjs
```

Output: `reports/analytics/pass-rate-forecast.json`. Đọc forecast 7 ngày → có ngày nào predicted < 0.95? → trigger §2.4.

### 2.4 Trend analysis (chỉ làm khi panel 9 slope đi xuống)

1. Run `node scripts/regression-risk.cjs` → top 3 high-risk tests.
2. Cross-reference với Issue label `ci-fail-auto` 7 ngày qua: test nào fail nhiều nhất?
3. Quyết định:
   - **Quarantine** (nếu flaky pure): edit `src/utils/quarantine.config.ts` + add deadline 14 ngày.
   - **Fix root cause** (nếu real bug): create Issue `bug:<flow>` + assign self.
   - **Refactor selector** (nếu locator drift): wait self-heal-pr next run hoặc fix manual.

### 2.5 ROI report refresh

Edit `docs/m6-roi-report.md` §3 trend table, paste row tuần mới với data từ:
- `total_hours` từ maintenance-cost.json.
- `actual_runs` count từ Grafana panel 12.
- Compute `hours_saved`, `hours_spent` theo formula §1.

Commit: `chore: refresh ROI report W<N>`.

---

## 3. Monthly ops (1st thứ 2 mỗi tháng)

### 3.1 Debt log review

Mở `ROADMAP.md` Debt log section. Filter status ≠ 🟢:

- Debt nào quá deadline repay → bump severity hoặc justify defer.
- Debt nào nay đã solve organic (e.g., refactor code khiến debt tự đóng) → mark 🟢 với commit ref.

### 3.2 Decision log review

Đọc `ROADMAP.md` Decisions log. Decision nào không còn áp dụng (vì context thay đổi) → mark superseded với link sang decision mới.

### 3.3 Quarantine sweep

```bash
npm run check:quarantine
```

Test nào quá deadline 14 ngày → CI fail. Quyết định:
- Fix + un-quarantine.
- Hoặc bump deadline với justification (max 2 lần, sau đó delete test và mở Issue lý do).

### 3.4 Self-heal PR backlog

Mở GH PR list filter `label:self-heal`. Backlog > 5 PR → priority review:
- AI suggestion đúng → squash merge.
- AI suggestion sai → close PR + đánh nhãn `self-heal-rejected` (signal cho M7 cải tiến model).

### 3.5 Perf SLA calibration check

Spec §7.5 perf threshold calibrated cho **real device** (Pixel 6 USB-tethered).
Emulator P95 baseline ~4-5x slower (RCA TC_PERF_LOGIN_001 2026-05-01) — chạy
emulator với contract default sẽ false-fail.

Mỗi `AC_PERF_*.yaml` declare `threshold_env_var`; spec implementation đọc
qua `resolvePerfThreshold()` helper (`src/utils/perf/resolveThreshold.ts`).
Khi auto-detect emulator (regex match `ANDROID_DEVICE_NAME`) mà env override
KHÔNG set → logger warning + dùng contract default (sẽ fail nếu run).

**Calibration table (baseline 2026-05-01):**

| Flow | Real device P95 (Pixel 6 USB) | Emulator P95 (Pixel 6 API 33) | Contract default | Recommended emulator override |
|------|-------------------------------|-------------------------------|------------------|-------------------------------|
| Login | ~1300 ms | ~4500 ms | `max_ms: 2000` | `PERF_LOGIN_SLA_MS=5000` |
| Checkout | ~3500 ms | ~10000 ms | `max_ms: 5000` | `PERF_CHECKOUT_SLA_MS=12000` |
| Search (products render) | ~900 ms | ~3200 ms | `max_ms: 1500` | `PERF_SEARCH_SLA_MS=4000` |

**Override workflow:**
1. Detect device type: `ANDROID_DEVICE_NAME` matches `emulator-XXXX` /
   `Pixel_*_API_*` / `AVD_*` / `*_simulator` / `iPhone_*_Simulator` → emulator.
2. Uncomment `# === Emulator profile ===` block trong `.env.example` →
   copy vào `.env.local`.
3. Override heuristic mis-classify: set `PERF_FORCE_DEVICE_TYPE=real|emulator`.
4. Re-run perf suite: `npm run test:perf`.

Monthly task: re-run baseline khi đổi device hardware HOẶC sau bump Appium /
WDIO version. Append data point vào table này (commit message
`chore(perf): refresh baseline <device>`) — drift > 20% từ last data point →
flag M7 task investigate (env regression hoặc framework overhead).

---

## 4. New test onboarding (PRD → spec → ship)

**Bắt buộc 7 step. Không skip Step 2.**

### Step 1: Requirement analysis (skill `test-requirement`)

Input: PRD/ticket Vietnamese description.
Output: `docs/test-design/<TC_ID>.scenario.yaml`:
```yaml
test_id: TC_FEATURE_001
title: "..."
preconditions: [...]
steps: [...]
expected: [...]
testability_score: HIGH | MEDIUM | LOW
risks: [...]
```

Anti-pattern: bắt đầu code spec trước khi có scenario YAML → bug rule §3 spec.

### Step 2: Assertion Contract design (skill `assertion-contract`)

Output: `src/contracts/AC_<FEATURE>_<NUM>.yaml`:
- positive_layer (UI + API + State, có severity).
- negative_layer (xử lý lỗi).
- performance_layer nếu critical flow (P95 SLA per spec §7.5).
- visual_layer optional cho UI heavy.

**Block-merge rule:** không merge spec mà không có contract. Test mà chỉ assert UI là **false-pass trap** (CLAUDE.md §1).

### Step 3: Test data + env (skill `test-data-setup`)

Cần account → register vào `src/utils/accountPool/pool.config.json`.
Cần fixture → `tests/fixtures/`.
Cần network sim → `NETWORK_SIM_DEFAULT` env override per-test.

### Step 4: Implement (skill `test-implement`)

```
src/pages/<Feature>Page.ts        # Page Object
tests/<suite>/<feature>.spec.ts   # spec gọi runner.runContractById()
```

Convention:
- Selectors `~test-*` (Sauce Demo accessibility ID).
- KHÔNG `browser.pause()`. Dùng `waitForVisible()` hoặc `browser.waitUntil()`.
- KHÔNG hardcode credential — dùng `globalThis.testAccount` (M3 account pool).

### Step 5: Execute + observe local

```bash
npm run test:smoke -- --spec tests/<suite>/<feature>.spec.ts
```

Verify Allure attach screenshot/log on-fail.

### Step 6: Validate (skill `test-validate`)

Run 5 lần liên tục local: 5/5 pass = stable. 4/5 = SUSPECTED_FLAKY → quarantine + RCA. 0/5 = real bug.

### Step 7: PR + review (skill `test-review`)

Self-review checklist (Trustworthiness Pyramid spec §1.2):
- [ ] Reliable: pass 5/5, no `pause()`.
- [ ] Meaningful: assert multi-layer (UI + API hoặc State), không chỉ UI.
- [ ] Maintainable: Page Object, không inline selector trong spec.
- [ ] Traceable: Allure attach, contract ID match.

Submit PR → CI gate → merge.

---

## 5. Failure response (RCA workflow)

**Khi:** test fail trong CI hoặc Issue `ci-fail-auto` mới tạo.
**Skill:** `failure-rca`. Spec §6.2 routing decision matrix.

### 5.1 Open RCA template

Tạo file `docs/rca/<YYYY-MM-DD>-<test_id>.md` từ template `docs/rca/_template.md` (nếu chưa có template thì copy từ runbook M5 acceptance §5).

### 5.2 Classify (auto + manual)

1. Run `node src/utils/classifier/cli.cjs <allure-result-id>` (M5 Task 2 classifier).
2. Verdict gồm: `category` (`flaky` | `real_bug` | `infra` | `data` | `false_positive`) + `confidence` + `routeTo` (1-8).
3. Nếu confidence < 0.9 → escalate LLM: `LLM_PROVIDER=gemini node src/utils/classifier/escalate.cjs <id>`.

### 5.3 Route theo verdict

| Verdict | Action |
|---------|--------|
| `real_bug` (routeTo=1) | Tạo Issue `bug:<feature>` + tag PRD owner. |
| `flaky` (routeTo=5) | Quarantine 14 ngày + add to `tmp/m6-maintenance-overrides.json` nếu fix > 4h. Commit `fix(flaky): <test_id>`. |
| `infra` (routeTo=3) | Check Docker / BS quota / Influx connectivity. Restart stack nếu cần. |
| `data` (routeTo=3) | Check account pool state lock leak; reset `tmp/account-pool.state.json`. |
| `false_positive` (routeTo=2) | Fix Assertion Contract — usually `severity: critical` quá strict cho non-critical layer. |

### 5.4 Update KB

Append to `docs/flaky_kb.md` 1 row:

```
| <date> | <test_id> | <category> | <confidence> | <root_cause_1_line> | <fix_commit_sha> |
```

KB feed M5 classifier rule next iteration.

---

## 6. Release cycle (3 gate sequential)

### Gate 1: Smoke gate (mỗi PR)

CI workflow `ci.yml` chạy:
1. lint + typecheck + unit.
2. integration + api (mock).
3. E2E smoke 1 device.

Pass = merge OK.

### Gate 2: Regression gate (mỗi merge to main)

CI workflow `regression.yml` chạy nightly cron + manual dispatch:
1. Full unit + integration + api (gated network ON).
2. KPI gate `check-kpi-window.cjs --soft` (warn-only ban đầu, hard sau 14d data).

Fail = `notify-fail.yml` tạo Issue, không block merge sau (đã merge rồi).

### Gate 3: KPI sustain gate (M6 acceptance)

Manual + auto. Khi M6 muốn close:
1. Verify panel 11 ≥ 10/14.
2. Run `docs/runbook-M6-acceptance.md` 8 §.
3. Mark M6 🟢 trong ROADMAP.

### Hot-fix release flow (skip gate 2 + 3)

Chỉ áp dụng khi P0 production bug:
1. Branch `hotfix/<bug>` từ main.
2. Fix + Gate 1 only.
3. Merge fast-forward.
4. **Sau đó** chạy gate 2 manual: `gh workflow run regression.yml`.
5. Document trong RCA template `severity: P0` + lessons.

---

## 7. Scripts cheat sheet

```bash
# Test execution
npm run test                 # full smoke local 1 device (default wdio.local.ts)
npm run test:smoke           # smoke suite
npm run test:smoke:20x       # 20-iteration flake hunter (M2 Task 5)
npm run test:regression      # full regression suite
npm run test:perf            # performance P95 (3 spec)
npm run test:visual          # visual baseline 5 screen
npm run test:nightly         # edge case + visual + perf combined
npm run test:negative        # error path tests
npm run test:bs              # BS smoke (1 device — env BS_DEVICE_FILTER override)
npm run test:bs:matrix       # 5 device matrix parallel
npm run test:bs:matrix -- --sequential   # 5 device serial (BS quota safe)
npm run test:pact            # Pact consumer tests (auth + cart)

# Quality gates
npm run lint
npm run lint:fix
npm run typecheck
npm run format
npm run format:check
npm run test:unit
npm run test:integration
npm run test:api

# Utilities
npm run check:quarantine               # CI gate: quá deadline 14d
npm run build:test-apk                 # build minimal Kotlin APK (M4 Task 13)
npm run allure:generate                # generate HTML report from results
npm run allure:open                    # open generated report
npm run allure:serve                   # serve results live

# Analytics (M6 Task 7)
node scripts/analytics-trend.cjs       # 7-day pass rate forecast
node scripts/regression-risk.cjs       # top 3 risk tests
node scripts/maintenance-cost.cjs      # flaky-fix hours from git log

# Gates (M6 Task 6)
node scripts/check-kpi-window.cjs           # hard gate (exit 1 on miss)
node scripts/check-kpi-window.cjs --soft    # warn-only

# CI helpers
node scripts/append-duration.cjs       # emit pipeline_duration to Influx (CI use)
node scripts/extract-allure-failures.cjs    # parse failure metadata for RCA

# Self-heal + quarantine bots (M5)
node scripts/self-heal-pr.cjs          # AI-suggested locator fix PR
node scripts/auto-quarantine-pr.cjs    # auto-quarantine flaky PR
```

---

## 8. Troubleshooting common issues

### "Test fail trong CI nhưng pass local"

1. Check env diff: `.env.local` vs CI secrets. Most common: account pool config path khác.
2. Check timing: CI runner slower → wait timeout cần tăng. Edit `DEFAULT_WAIT_TIMEOUT` env.
3. Check artifact: download Allure zip từ Actions, mở local, đọc page source attached.
4. Nếu vẫn không repro → flaky → quarantine + escalate `failure-rca` skill.

### "Account pool lock leak"

```bash
rm tmp/account-pool.state.json   # reset lock state
```
Root cause: `afterEach` không release. Audit hook code.

### "BS connection timeout / 401"

1. Verify `.env.local` `BS_USERNAME` / `BS_ACCESS_KEY` đúng (copy từ BS dashboard, không paste extra space).
2. Verify `BS_APP_URL` còn valid (BS retain 30d → re-upload nếu hết hạn):
   ```bash
   curl -u "$BS_USERNAME:$BS_ACCESS_KEY" -X POST \
     https://api-cloud.browserstack.com/app-automate/upload \
     -F "file=@./apps/SauceLabs-Demo-App.apk"
   ```
3. Free trial cạn quota → upgrade plan hoặc Decision 3 fallback (real device local).

### "Influx query empty / 'No data' panel"

1. Stack down: `docker compose -f infra/observability/docker-compose.yaml ps` → expect "Up".
2. Token expire / wrong: verify `INFLUX_TOKEN` env match container token.
3. Bucket retention quá ngắn: default 30d, panel 14d window OK; nếu sustained window > 30d cần adjust retention.

### "Self-heal PR đề xuất locator sai"

KHÔNG auto-merge (CLAUDE.md §1.6 rule). Close PR với label `self-heal-rejected`, comment lý do. Manual fix Page Object selector.

### "LLM budget exceeded"

```bash
cat tmp/llm-spend.json    # current month spend
```
- Hard cap 20 USD/month (Decision M5). Thay đổi: `LLM_BUDGET_MONTHLY_USD=50`.
- Hoặc switch provider: `LLM_PROVIDER=ollama` (local, free).

### "Quarantine deadline expired"

```bash
npm run check:quarantine    # CI fail
```
Decision tree:
1. Có thời gian → fix root cause + un-quarantine.
2. Hết thời gian → delete test + Issue lý do (debt log row mới với severity).
3. Vẫn cần test nhưng không fix kịp → bump deadline +14d MAX 2 lần. Sau đó delete bắt buộc.

---

## 9. Onboarding new team member (future state, post-M6)

Day 1 reading list (3-4h):
1. `README.md` → setup environment.
2. `automation_testing_requirement.md` (Vietnamese spec) — đọc §1, §2, §5, §6.
3. `CLAUDE.md` — convention + non-negotiable rules.
4. `ROADMAP.md` — milestone status.
5. **Runbook này** (`docs/runbook-operations.md`).

Day 2 hands-on:
1. Clone repo + setup local emulator (per `docs/runbook.md`).
2. Run `npm run test:smoke` → 1 device pass.
3. Pair với Phuc viết 1 test mới qua workflow §4.
4. Submit PR → review process per §6 Gate 1.

Week 1 ramp-up:
1. Triage 1 RCA Issue qua skill `failure-rca`.
2. Refresh ROI weekly per §2.5.
3. Read 5 random `docs/rca/*.md` để hiểu failure pattern.

---

## 10. Process improvement loop

Khi gặp issue lặp lại lần thứ 2 mà runbook chưa cover:

1. Mở section §8 troubleshooting.
2. Add 1 entry mới theo format `### "<tình huống>"` + steps.
3. Commit `docs(runbook): ops add <issue>`.

Khi convention mới được agree (e.g., naming, file layout):

1. Update `CLAUDE.md` (project-level) hoặc runbook này (operational).
2. Reference từ skill nếu skill cần biết.

**Quy tắc:** đừng để tribal knowledge tồn tại quá 1 lần lặp — write it down hoặc remove the friction.

---

## References

- Spec gốc: `automation_testing_requirement.md`
- Project conventions: `CLAUDE.md`
- Roadmap + debt log: `ROADMAP.md`
- M6 plan: `docs/plans/M6-optimization.md`
- M6 acceptance: `docs/runbook-M6-acceptance.md`
- Runbook setup: `docs/runbook.md`
- PR merge gate: `docs/runbook-pr-merge-gate.md`
- Skills: `.claude/skills/*/SKILL.md`
