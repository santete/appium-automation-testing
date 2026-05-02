# M6 — Optimization & Scale

> Implementation plan cho milestone M6. Workflow đầy đủ xem `docs/plans/README.md`.
> **Status: 🔵 Plan ready v1.0 (sign-off 2026-05-01)** — Decisions 1-9 confirmed bởi Phuc DN; sẵn sàng execute Task 0.

## Metadata

| Field | Value |
|-------|-------|
| Milestone ID | M6 |
| Spec section | `automation_testing_requirement.md` §11 Phase 6 (Week 17+), §8 (KPI), §6.5 (KB), §7.5-7.6 (visual + perf) |
| Status | 🔵 Plan ready |
| Plan author | Claude Opus 4.7 (with Phuc DN) |
| Plan version | v1.0 |
| Created | 2026-04-29 |
| Sign-off date | 2026-05-01 |
| Sign-off by | Phuc DN |
| Target start | 2026-05-01 |
| Target end | ~2026-06-05 (ước ~3-5 tuần gồm closure batch repay D5+D6 + M5 verify-only debt) |
| Actual start | — |
| Actual end | — |

---

## 1. Goal

Đạt target KPI spec §8 trong **2 tuần liên tục** (genuine pass > 95%, flaky < 3%, false-positive < 1%, critical coverage 100%, MTTD < 30min, MTTF P0 < 4h, pipeline PR < 10min, regression < 30min) đồng thời mở rộng coverage qua perf + visual + cross-device + contract test.

Đồng thời **đóng debt batch theo Decision 10 M5** — D5+D6 verify-only debt từ M4 + 4 sub-points verify-only debt từ M5 closure walkthrough Phuc DN tự verify trong M6 sprint cuối.

## 2. Done criteria (acceptance test)

> Tất cả KPI §8.1-8.3 đạt target trong **2 tuần liên tục** (= 10 working day với CI run hàng ngày):
> - Genuine pass rate > 95%
> - Flaky rate < 3%
> - False positive < 1%
> - Critical flow coverage 100%
> - MTTD < 30 min, MTTF P0 < 4h
> - Pipeline PR < 10 min, regression < 30 min

**Acceptance test cụ thể (đề xuất, sign-off chốt):**

1. **KPI dashboard 2-week sustained** — Grafana dashboard (M5 Task 5) thêm panel KPI §8.1-8.3 với 14-day rolling window; mỗi KPI có target line + actual line; verify dashboard show **toàn bộ 7 KPI ở trạng thái green ≥ 10/14 ngày liên tiếp** (≥ 70%).
2. **Performance test active** — ≥ 3 perf test (login P95, checkout P95, search P95) trong `tests/perf/` với assertion contract `performance_layer` có SLA threshold; chạy cùng nightly regression; verify break SLA → fail correctly + route step 7.
3. **Visual regression baseline** — ≥ 5 critical screen (login, products list, cart, checkout, finish) có visual baseline + 1 dev test diff > threshold → fail correctly với image diff attached vào Allure.
4. **Cross-device matrix** — ≥ 5 device cụ thể (1 cấu hình real local + 4 device farm config-driven stub `wdio.bs.ts` enabled) chạy smoke pass; matrix run thành công trên BS hoặc Sauce Labs ít nhất 1 lần.
5. **Pact contract test** — ≥ 2 contract giữa mobile client + backend stub (vd. `auth-service`, `cart-service`); CI fail khi consumer break contract.
6. **Test analytics** — `scripts/analytics-trend.cjs` hoặc dashboard panel show: pass rate trend prediction (next 7 day forecast), top 3 regression risk test (high churn + low pass rate combined score), maintenance cost tracker (hours/sprint fix flaky tracked qua git log).
7. **ROI report** — single-page markdown `docs/m6-roi-report.md` ghi: manual hours saved (estimate per test × runs), maintain hours actual (git blame fix-flaky commits + RCA time tracking), ratio + trend over 4-week window.
8. **Debt closure batch** — D5+D6 (M4 verify-only) + 4 M5 verify-only sub-points (dashboard live, self-heal PR end-to-end, Allure URL share, notify fan-out) Phuc walkthrough qua `docs/runbook-M4-acceptance.md` + `docs/runbook-M5-acceptance.md` + screenshot evidence; repay all → debt log ID D5+D6 → 🟢 Repaid.

## 3. Scope

### In scope (M6)

- **Performance test integration** (spec §7.5) — Appium `getPerformanceData` + perf assertion contract section + nightly regression coverage.
- **Visual regression** (spec §7.6) — tool TBD (Decision 1); baseline + diff threshold + Allure attach + flake handling.
- **Cross-device matrix** — wire ≥ 1 device farm provider (BrowserStack hoặc Sauce Labs) qua existing `wdio.bs.ts` / `wdio.sauce.ts` stub; matrix list TBD (Decision 3).
- **Pact contract test** — minimum 2 consumer-driven contract; provider verification owner TBD (Decision 2).
- **Test analytics dashboard panels** — extend Grafana M5 dashboard với trend prediction + regression risk + maintenance cost.
- **ROI report** — markdown một lần, manual + automated calculation reuse được.
- **KPI sustained verification** — 2-week rolling window assertion script (CI gate hoặc manual review).
- **Debt closure batch** (Decision 10 M5) — D5+D6 + M5 verify-only debt.
- **iOS support consideration** — re-evaluate (đã defer M5; Mac runner availability TBD trong Decision 9).

### Out of scope (explicit)

- **Self-hosted runner setup** — defer hậu M6 nếu cần (BS/Sauce đã cover device coverage cho M6).
- **Custom ML model training cho classifier** — M5 LLM API + rule-based đủ cho pass criteria; ML training cần dataset + ops infra ngoài scope 1-eng.
- **Allure TestOps SaaS migration** — GH Pages M5 đủ; SaaS evaluate khi có team.
- **Microservice architecture cho framework** — single-repo + single-runner pattern giữ; framework as library scope hậu M6.
- **Public open-source release** — internal use M6; OSS-ready cleanup defer.

---

## 4. Technical decisions (SIGNED OFF 2026-05-01 — Phuc DN)

Trả lời tất cả "Plan checklist" trong ROADMAP.md M6 + thêm các decision phát sinh từ M5 carry-over.

**Sign-off summary (2026-05-01):** D1 OK, D2 OK, D3 default + fallback real device cắm trực tiếp, D4 OK, D5 Hybrid (default), D6 default, D7 default, D8 default, D9 default.

### Decision 1: Visual regression tool

- **Question (ROADMAP.md):** Applitools / Percy / resemblejs (free)?
- **Options considered:**
  - **Applitools Eyes:** AI-powered DOM-aware compare, Appium SDK ready, free 1 team / 100 checkpoint/month → đủ cho M6 baseline 5 screen × 4 run/day = 600/month → **vượt free tier** sau ~5 ngày. Paid plan ~$50/month. Pros: best-in-class diff intelligence (anti-aliasing, dynamic content). Cons: cost.
  - **Percy:** BrowserStack-acquired, free 5K screenshot/month, Appium support OK; pros: free tier rộng, GH integration native. Cons: locked vào BS account.
  - **resemblejs (DIY):** open-source, image diff with tolerance percentage; pros: free + self-host (no SaaS dep); cons: phải tự build attach Allure + baseline storage (S3 hoặc git LFS) + flake handling cho dynamic content (timestamp, animation).
- **Default proposal:** **resemblejs** — solo dev + zero recurring cost ưu tiên; baseline lưu trong `tests/visual-baselines/<screen>.png` (git LFS hoặc skip LFS dùng PNG nhỏ < 200KB). Diff threshold 5% (configurable). Áp đúng pattern Decision 1 M5 (zero-cost self-host). Migrate Percy hoặc Applitools nếu pain point lộ ở M6+.
- **Rationale:** giữ workflow solo-local-first; resemblejs đủ cho 5 screen baseline; không bị vendor lock.
- **Sign-off (2026-05-01):** default accepted (resemblejs).

### Decision 2: Pact provider verification owner

- **Question (ROADMAP.md):** ai own backend integration?
- **Options considered:**
  - **Mobile team own consumer + provider stub** — viết consumer test (mobile side) + provider stub (mock backend trong CI); pros: không block backend team, contract verified end-to-end trong test repo. Cons: stub không phải real backend → drift risk khi backend deploy.
  - **Backend team own provider verification** — Pact broker shared, backend CI verify contract trong pipeline của họ; pros: real provider verified, drift detected real-time. Cons: cần coordinate backend team + Pact broker infra (paid SaaS hoặc self-host).
  - **Skip Pact, dùng Zod schema validation hiện tại làm contract** — M2 đã có Zod schema cho API response; treat schema làm contract; pros: không cần infra mới. Cons: chỉ verify response shape, không verify request shape; không cover provider-side breaking change detection.
- **Default proposal:** **Mobile team own consumer + provider stub** — solo dev, không có backend team coordinate; viết 2 contract minimum (auth + cart). Provider stub run trong CI qua Pact CLI. Pros: ship được M6 mà không block backend team; cover §10 spec yêu cầu "Contract testing với backend".
- **Rationale:** pragmatic cho 1-eng; future M6+ có thể migrate sang real backend khi team scale.
- **Sign-off (2026-05-01):** default accepted (Mobile own consumer + provider stub).

### Decision 3: Device matrix list (5 device)

- **Question (ROADMAP.md):** 5 device cụ thể nào?
- **Options considered:**
  - **Top 5 popularity Android (StatCounter Vietnam 2026):** Samsung Galaxy A14, Xiaomi Redmi Note 12, Samsung Galaxy A54, Oppo A78, Vivo Y36 → pros: realistic VN user base. Cons: không có iOS coverage.
  - **Mixed Android + iOS:** 3 Android (Samsung A14, Pixel 7, Xiaomi Redmi Note 12) + 2 iOS (iPhone 14, iPhone SE 3rd gen) → pros: cross-platform coverage; cons: cần iOS support active (xem Decision 9).
  - **Spec scale matrix:** Android 24 + 28 + 31 + 34 (4 SDK) + 1 iOS → focus OS version coverage, ít device variety.
- **Default proposal:** **Mixed Android + iOS** — Samsung Galaxy A14 (mid-range Android, SDK 33), Pixel 7 (Google reference, SDK 34), Xiaomi Redmi Note 12 (popular VN, SDK 33), iPhone 14 (iOS 17), iPhone SE 3rd gen (iOS 16, smaller screen). Wire BS làm primary provider (Decision 4).
- **Rationale:** balance user base + spec coverage; iOS coverage trigger khi Decision 9 chốt iOS support.
- **Sign-off (2026-05-01):** **default proposal Mixed Android+iOS qua BS** + **fallback real device cắm trực tiếp** (Android dev workstation) nếu BS quota / setup gặp blocker. Acceptance test §2.4 đã viết "1 cấu hình real local + 4 device farm" → khớp sign-off. Nếu BS access fail hoàn toàn, scope giảm xuống Android-only real device matrix (1 local + 0-1 farm), iOS dời Task 8 spike-only. Document fallback path trong `docs/runbook-M6-acceptance.md` Task 10.

### Decision 4: Device farm provider primary

- **Question (mới phát sinh):** BrowserStack hay Sauce Labs làm primary cho device matrix?
- **Options considered:**
  - **BrowserStack** — wider device coverage (~3000 device), Appium 2 support strong, CI integration native, pricing pay-as-you-go starts $39/month. Free trial 100 min.
  - **Sauce Labs** — deep enterprise + Appium support, real device cloud, slightly higher cost (~$49/month entry); pros: better debug tools (video + log).
- **Default proposal:** **BrowserStack** — config-driven stub `wdio.bs.ts` đã sẵn từ M4 Task 3; Phuc fill `BS_USERNAME`/`BS_ACCESS_KEY` trong `.env.local` để switch on. Free trial đủ verify acceptance test §4 (1-2 run × 5 device).
- **Rationale:** stub đã ship; switch on chỉ cần fill `.env`; pay-as-you-go scale linear với usage.
- **Sign-off (2026-05-01):** default accepted (BrowserStack).

### Decision 5: KPI tracking + 2-week sustained verification

- **Question (mới phát sinh):** KPI gate verification → CI gate auto block hay manual review weekly?
- **Options considered:**
  - **CI gate** — `scripts/check-kpi-window.cjs` đọc Influx 14d data, exit 1 nếu bất kỳ KPI < target; pros: block bad merge automatic. Cons: false-fail khi infra outage misclassify.
  - **Manual weekly review** — Phuc đọc dashboard mỗi thứ 2; pros: human judgment cho edge case (vd. infra outage skew metric). Cons: delay detect bad trend.
  - **Hybrid** — CI gate cho 4 critical KPI (genuine pass / flaky / false-positive / pipeline PR duration); manual review cho 3 còn lại (coverage / MTTD / MTTF — đo qua RCA history).
- **Default proposal:** **Hybrid** — gate auto cho 4 critical (run mỗi PR + nightly), manual review hàng tuần cho 3 còn lại (Phuc tự đọc dashboard panel). Critical KPI miss → CI red + Issue auto-create (reuse `notify-fail.yml` M5 Task 10).
- **Rationale:** balance automation + judgment; align Decision 6 M5 (notify GH Issue primary).
- **Sign-off (2026-05-01):** **Hybrid** accepted (default proposal).

### Decision 6: Maintenance cost tracker source

- **Question (mới phát sinh):** track flaky-fix hours từ đâu?
- **Options considered:**
  - **Git log + commit message convention** — commit message prefix `fix(flaky):` đếm count + estimate 1h/commit average; pros: zero new tooling. Cons: rough estimate, không có actual time.
  - **Manual time entry** — Phuc nhập `tmp/m6-maintenance-log.json` mỗi lần fix; pros: accurate. Cons: discipline overhead.
  - **GH issue label `flaky-fix` + close time tracking** — GH API extract issues with label + computed close - open duration; pros: semi-automatic. Cons: assume open issue trước fix (workflow change).
- **Default proposal:** **Git log + commit message convention** — adopt convention `fix(flaky): <test_id> ...`; `scripts/maintenance-cost.cjs` parse `git log` + count → estimate × 1h; show panel Grafana. Phuc manual override cho big fix (>4h) qua `tmp/m6-maintenance-overrides.json`.
- **Rationale:** zero new infra; matches solo-dev workflow; pattern compatible khi team scale (commit convention organic adopt).
- **Sign-off (2026-05-01):** default accepted (git log + `fix(flaky):` convention).

### Decision 7: ROI report data source

- **Question (mới phát sinh):** manual hours saved tính thế nào?
- **Options considered:**
  - **Per-test fixed estimate** — vd. 5 phút/test/run × runs/day × 30 day = saved hours; pros: simple. Cons: assumes manual would actually run mỗi run (overestimate).
  - **Critical flow only weighted** — chỉ tính critical flow (login, checkout, payment) × actual run frequency; pros: realistic. Cons: undercount.
  - **Industry benchmark scaled** — apply 80% saved ratio chuẩn industry (Capgemini study) lên total automated test time; pros: defensible. Cons: opaque.
- **Default proposal:** **Critical flow weighted** — formula: `sum(critical_flow_time × actual_runs × 0.7 efficiency)` minus `automated_run_time × runs`. Critical flow estimate hardcode trong `docs/m6-roi-report.md` (login=3min manual, checkout=8min, payment=10min). Run frequency từ Influx data (M5 Task 6).
- **Rationale:** conservative + transparent; reuse Influx data đã có; document formula trong report cho future audit.
- **Sign-off (2026-05-01):** default accepted (critical flow weighted formula).

### Decision 8: Debt closure batch sequencing

- **Question (mới phát sinh, Decision 10 M5 follow-up):** D5+D6+M5 verify-only debt — repay đầu M6 hay cuối M6?
- **Options considered:**
  - **Đầu M6 (sprint 1 closure batch)** — clear technical debt trước; pros: M6 bắt đầu clean slate. Cons: trì hoãn perf/visual implementation.
  - **Cuối M6 (sprint cuối closure batch)** — implement perf/visual song song, debt repay tail; pros: avoid context-switch giữa task; align M6 work với M5 acceptance walkthrough naturally (Phuc verify dashboard live khi đã có 14-day data thực tế). Cons: risk debt slip.
  - **Distributed** — D5+D6 đầu M6 (quick wins, GH UI clicks), M5 verify-only batch cuối M6 (cần infra real data từ M6 work).
- **Default proposal:** **Distributed** — D5+D6 đầu M6 sprint 1 (GH UI walkthrough + 1 device APK install + screenshot, ~2h); M5 verify-only debt batch sprint cuối M6 cùng KPI sustained 2-week run (Phuc verify dashboard end-to-end với real data, không phải synthetic). Closure single-walkthrough ~4h.
- **Rationale:** D5+D6 không phụ thuộc M6 work, nên đóng sớm; M5 dashboard/notify verify cần real CI data hàng ngày → batch cuối naturally align.
- **Sign-off (2026-05-01):** default accepted (distributed — D5+D6 sprint 1, M5 verify-only batch sprint cuối).

### Decision 9: iOS support trong M6

- **Question (mới phát sinh):** wire iOS support hay defer hậu M6?
- **Options considered:**
  - **Wire M6** — iOS qua BrowserStack (không cần Mac runner); CI Linux trigger BS macOS infra; pros: cross-platform matrix complete. Cons: scope creep, iOS smoke test rewrite + iOS-specific selector mapping.
  - **Defer hậu M6** — giữ Android-only; pros: M6 focus KPI sustained. Cons: spec §10 nói iOS support, không cover full spec.
  - **Spike M6** — 1 iOS test verify framework compat, không full coverage; pros: prove cross-platform hoạt động. Cons: spike thường turn into half-implementation.
- **Default proposal:** **Spike M6** — sprint 2 dành 4-6h spike: 1 iOS smoke test (login) trên BS iPhone 14 simulator. Document `docs/spikes/ios-support.md` kết quả pass/fail + estimate effort cho full coverage. Decision implement full iOS làm M7 hoặc defer indefinite tùy spike result.
- **Rationale:** giảm risk full iOS scope creep; spike de-risk; align spec §10 cross-platform mention nhưng không claim full coverage M6.
- **Sign-off (2026-05-01):** default accepted (Spike M6 — 1 iOS smoke + spike doc).

---

## 5. Task breakdown

> **Estimate basis:** solo dev autonomous (Claude execute) với checkpoint Phuc DN sign-off mỗi sprint. Sprint = ~5 working day, 6h/day Claude time.

| # | Task | Deliverable file | Estimate | Status | Skill |
|---|------|------------------|----------|--------|-------|
| 0 | Closure batch D5+D6 (M4 verify-only debt) — Phuc walkthrough GH UI 4 step + D4 device verify; archive screenshots | `docs/m4-closure-evidence.md` (screenshots paths) | 2h | ⬜ | (manual Phuc + skill `failure-rca` cho RCA template if any) |
| 1 | Performance test integration — extend assertion-contract `performance_layer` schema + Appium `getPerformanceData` adapter + 3 perf test | `src/utils/perf/`, `tests/perf/`, `src/contracts/AC_PERF_*.yaml` | 8h | ⬜ | `assertion-contract`, `test-implement` |
| 2 | Visual regression baseline + diff (resemblejs) — adapter + 5 baseline + Allure attach + flake handling | `src/utils/visual/`, `tests/visual-baselines/`, `tests/visual/` | 10h | ⬜ | `test-implement` |
| 3 | Pact contract test (consumer + provider stub) — auth + cart contract | `src/contracts/pact/`, `tests/pact/`, `scripts/run-pact.cjs` | 8h | ⬜ | `assertion-contract` |
| 4 | Cross-device matrix — wire BS provider (.env fill) + matrix runner script + 5-device smoke run | `src/config/wdio.bs.ts` revisit, `scripts/run-device-matrix.cjs` | 6h | ⬜ | `test-implement` |
| 5 | KPI dashboard panels (extend M5 Grafana) — 7 KPI panels + target line + 14-day rolling window | `infra/observability/dashboard.json` revise | 4h | ⬜ | `test-implement` |
| 6 | KPI gate script (Hybrid Decision 5) — 4 critical KPI auto-check, exit non-zero on violation | `scripts/check-kpi-window.cjs`, wire vào CI/Regression workflow | 4h | ⬜ | `test-implement` |
| 7 | Test analytics scripts — trend forecast + regression risk + maintenance cost | `scripts/analytics-trend.cjs`, `scripts/regression-risk.cjs`, `scripts/maintenance-cost.cjs` | 6h | ⬜ | `test-implement` |
| 8 | iOS spike (Decision 9) — 1 BS iPhone test + spike doc kết quả | `docs/spikes/ios-support.md`, `tests/smoke/login-ios.spike.ts` | 4-6h | ⬜ | `test-implement` |
| 9 | ROI report draft (Decision 7) — formula + initial calculation + dashboard link | `docs/m6-roi-report.md` | 3h | ⬜ | `test-review` |
| 10 | M6 acceptance runbook — 8 sub-point walkthrough mirror M5 pattern | `docs/runbook-M6-acceptance.md` | 3h | ⬜ | `test-review` |
| 11 | KPI sustained 2-week verification — chạy CI hàng ngày 10 working day, monitor green ratio ≥ 70% | (verify only — không deliverable file) | 2 calendar week | ⬜ | (monitoring) |
| 12 | Closure batch M5 verify-only — Phuc walkthrough 4 sub-points + archive evidence | `docs/m5-closure-evidence.md` (screenshots + confusion matrix paste) | 4h | ⬜ | (manual Phuc + skill `failure-rca` if needed) |

**Total estimate:** ~58-60h coding + 2 calendar week sustain + ~10h Phuc walkthrough = **~3-5 calendar week** (depends on Phuc availability cho closure walkthrough).

## 6. Dependencies

### Upstream (must finish first)

- [x] M5 done — dashboard infra + classifier + KB cần làm input cho M6 analytics + KPI gate.
- [ ] Phuc DN fill `.env.local` BS credentials (Task 4 cần) — **blocker cho Task 4**.
- [ ] Phuc DN fill `LLM_API_KEY` (M5 Task 2+4 verify-only debt) — **blocker cho closure Task 12**.

### Downstream (block these)

- M7+ (chưa scope) sẽ block until M6 done (KPI sustained mới prove framework production-ready).

### External dependencies

- BrowserStack account (free trial OR paid, Decision 4) — Phuc tạo trial trước Task 4.
- (Optional) iOS provisioning profile cho BS iPhone test — Phuc trial credentials đủ.
- 2 calendar week CI run hàng ngày cho Task 11 sustained — không gián đoạn.

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Visual regression flake do dynamic content (timestamp, ad) | H | M | resemblejs threshold 5% + mask region (timestamp area whitelist trong baseline metadata); document trong `tests/visual/README.md`. |
| BS free trial 100 min cạn trước verify | M | M | Run 5-device matrix 1-2 lần verify only; Phuc upgrade paid plan nếu M6 cần daily run. Decision 4 fallback Sauce. |
| KPI sustained 2-week miss target do real bug spike | M | H | Threshold tolerance — Decision 5 yêu cầu ≥ 10/14 ngày green = 70% (không phải 100%). Single-day infra outage không kill milestone. |
| iOS spike turn into full implementation creep | M | M | Time-box hard 6h; spike doc deadline + Phuc gate trước expand scope. |
| Pact provider stub drift với real backend | L (M6) → H (production) | M | Document `docs/pact-stub-limitations.md` rõ là internal contract; M7+ migrate provider verification về backend team CI khi có resource. |
| Closure batch (Task 0 + 12) bị defer indefinite vì Phuc bận | M | M | Schedule closure walkthrough trong sprint plan (Task 0 sprint 1, Task 12 sprint cuối); Phuc commit slot 2-4h mỗi sprint cuối. |
| Maintenance cost tracker miss flaky-fix commits không follow convention | H | L | Phuc adopt `fix(flaky):` convention từ sprint 1; `scripts/maintenance-cost.cjs` warn cho commit khớp pattern nhưng thiếu test_id; manual override JSON cho exception. |
| Performance test SLA threshold quá strict → flake | M | M | SLA threshold per spec §7.5 (login P95 < 2s, checkout P95 < 5s, search P95 < 1.5s); soft assertion mode cho perf layer (M2 pattern); flake → adjust threshold + document trong assertion contract. |

## 8. Test plan (verify deliverables)

- [ ] Unit test cho perf adapter + visual diff adapter + Pact runner đạt coverage > 80%.
- [ ] Integration test: 1 perf test chạy real (gated `RUN_PERF=1`), 1 visual test diff threshold, 1 Pact provider verification run trong CI.
- [ ] Manual smoke: BS device matrix 5 device × login smoke pass.
- [ ] Acceptance test trong section 2 pass — KPI dashboard 2-week green ≥ 10/14, perf test active, visual baseline 5 screen, cross-device matrix 5 device, Pact 2 contract, analytics panels live, ROI report committed, debt closure 8 evidence items archived.
- [ ] Lint ✅, typecheck ✅, full unit test suite ≥ 250 specs pass (M5 baseline 209 + ~40 từ M6 perf/visual/pact).

## 9. Rollback plan

Nếu phải hủy milestone giữa chừng:

- **Task 1-4 partial:** giữ committed code dưới feature flag `M6_ENABLE_*` env var (default off). Rollback = unset env. Code không block existing test.
- **KPI gate (Task 6) false-positive nhiều:** disable CI step (comment-out trong `ci.yml`), revert sang manual review (Decision 5 fallback). Document trong M6 plan revision.
- **BS subscription cancel:** revert `wdio.bs.ts` về stub mode (Decision 4 fallback Sauce); device matrix Task 4 mark verify-only debt.
- **Visual regression flake không control được:** disable visual layer trong assertion contract; escalate decision sang Applitools (paid) M7+.

## 10. Sign-off checklist

Trước khi chuyển status → 🔵 Plan ready:

- [x] Goal + Done criteria khớp ROADMAP.md (re-verify Decision 8 gate logic match KPI table)
- [x] Scope rõ ràng (in/out)
- [x] Tất cả 4 "Plan checklist" trong ROADMAP.md M6 đã trả lời (Decision 1-3 + iOS Decision 9)
- [x] M5 verify-only debt fold vào M6 closure batch (Task 0 + 12) — explicit acknowledgment
- [x] Task breakdown có owner + estimate
- [x] Dependencies xác định (BS credential + LLM key blockers explicit)
- [x] Risks đã thảo luận
- [x] Phuc DN approve Decision 1-9 (Decision 4 + 5 + 6 + 7 + 8 + 9 mới phát sinh M6) — sign-off 2026-05-01

## 11. Status updates (weekly)

| Date | Update | Blockers |
|------|--------|----------|
| 2026-04-29 | Plan v0.1 draft published autonomous batch ngay sau M5 closure (per Phuc DN standing instruction "cứ triển khai theo thứ tự trên thôi, không skip đợt nào cả, cho tới khi nào gặp được M6"). 9 decisions proposed (3 từ ROADMAP M6 checklist + 6 mới phát sinh từ M5 carry-over + closure batch policy). 13-task breakdown ~60h + 2-week sustained verify + ~10h Phuc walkthrough. **Status → 📝 Planning. Chờ Phuc DN review + sign-off.** Acceptance test 8 sub-points proposed. | Phuc DN review window. Phuc fill `.env` BS credentials trước Task 4. Phuc fill LLM key trước Task 12 walkthrough. |
| 2026-05-01 | **Phuc DN sign-off Decisions 1-9.** D1 OK (resemblejs), D2 OK (mobile own consumer + provider stub), D3 default (Mixed Android+iOS) + fallback real device cắm trực tiếp khi BS gặp blocker, D4 OK (BrowserStack), D5 Hybrid (default), D6 default (git log convention), D7 default (critical flow weighted), D8 default (distributed closure), D9 default (iOS spike). Plan v0.1 → v1.0. **Status → 🔵 Plan ready.** Sẵn sàng execute Task 0 (D5+D6 closure walkthrough đầu sprint 1). | Phuc fill `BS_USERNAME`/`BS_ACCESS_KEY` trong `.env.local` trước Task 4. Phuc fill `LLM_API_KEY` trước Task 12 closure walkthrough. |
| 2026-05-01 | **M5 LLM provider extended — `gemini` support shipped** (M6 prerequisite). Phuc chosen Gemini 2.5 Flash. `src/utils/llm/geminiAdapter.ts` native REST endpoint (`POST /v1beta/models/{model}:generateContent` + `x-goog-api-key`) + factory case + `LLM_PROVIDER` Zod enum extend + `.env.example` comment update. 11 tests added (8 adapter + 3 factory): typecheck ✅, lint ✅, unit 209/209 → 220/220 ✅. Phuc fill: `LLM_PROVIDER=gemini`, `LLM_API_KEY=AIza...` (lấy https://aistudio.google.com/apikey), `LLM_MODEL=gemini-2.5-flash`. ROADMAP Decisions log row mới 2026-05-01 ghi nhận extension (supersedes Decision M5 2026-04-28 provider list). | (none — adapter ship xong, Phuc fill key khi sẵn sàng test Task 12 walkthrough live LLM call) |

## 12. Plan revisions

Ghi lại mọi thay đổi plan sau khi đã sign-off:

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| _(điền khi có revision)_ | | | |

## 13. Closure

Điền khi mark milestone DONE:

- [ ] Tất cả deliverables ở section 5 status = 🟢
- [ ] Acceptance test ở section 2 pass (kèm evidence)
- [ ] D5 + D6 debt log status → 🟢 Repaid (Phuc walkthrough evidence trong `docs/m4-closure-evidence.md`)
- [ ] M5 verify-only debt 4 sub-points → archived trong `docs/m5-closure-evidence.md`
- [ ] Decisions log trong ROADMAP.md đã update (Decision 1-9 M6 thêm row)
- [ ] ROADMAP.md status M6 = 🟢
- [ ] Lessons learned cho framework production phase:
  - _(điền khi closure)_
