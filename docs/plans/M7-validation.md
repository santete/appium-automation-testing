# M7 — Validation Milestone (designed → battle-tested)

> Implementation plan cho milestone M7 — convert framework từ
> **"production-ready architecture"** sang **"production-proven, validated
> with real data"**. Workflow đầy đủ xem `docs/plans/README.md`.

## Metadata

| Field            | Value |
|------------------|-------|
| Milestone ID     | M7 |
| Spec section     | `automation_testing_requirement.md` §11 (Phase 7 — proposed extension) |
| Status           | 📝 Planning |
| Plan author      | Phuc DN (PO) |
| Plan version     | v0.1 (draft) |
| Created          | 2026-05-02 |
| Sign-off date    | pending |
| Sign-off by      | Phuc DN |
| Target start     | 2026-06-08 (sau M6 closure batch + 1 tuần buffer) |
| Target end       | 2026-07-13 (~5 tuần) |
| Actual start     | — |
| Actual end       | — |

---

## 1. Goal

Convert framework từ **"designed-and-built"** sang **"validated-with-real-data"**.

Hôm nay (2026-05-02) tỷ lệ tier rating: ~40% Tier 1+2 (production-proven),
~40% Tier 3 (proof-of-concept claim chưa validate), ~20% Tier 4 (shelfware).

**Goal M7:** đạt **≥ 80% Tier 1+2** — đủ căn cứ claim "production-proven
mobile automation framework" thay vì "vibe-spec".

Đồng thời đóng tất cả debt còn open từ M1-M6 batch (8 debt entry — xem §11).

## 2. Done criteria (acceptance test)

Acceptance walkthrough single-shot — tham chiếu pattern
`docs/runbook-M6-acceptance.md`. Tạo `docs/runbook-M7-acceptance.md` với
8 § sub-section:

1. ✅ **14-day KPI dashboard có data thật** — không synthetic. ≥ 200 test_run
   point trong Influx, panel "Daily KPI breakdown" populate đủ 14 ngày,
   green days/14 ≥ 10.
2. ✅ **Self-heal accuracy benchmark report** — `docs/m7-self-heal-benchmark.md`
   với precision/recall đo qua 30 inject locator drift. Target: precision
   ≥ 70%, recall ≥ 80%.
3. ✅ **LLM classifier calibration report** — `docs/m7-llm-calibration.md`
   với confusion matrix qua 50 historical fail manually labeled. Confidence
   threshold tuned (target accuracy ≥ 85% trên test set).
4. ✅ **20-run stability gate CI auto-enforce** — workflow `stability-gate.yml`
   chạy mọi spec mới (label `new-spec` trên PR) 20× trước merge; block merge
   nếu < 19/20 pass.
5. ✅ **iOS smoke production 5 spec** — không phải 1 spike. Run trên BS iPhone
   14 + iPhone 15 (2 device matrix iOS). Tier promote spike → Tier 2.
6. ✅ **BS matrix full regression end-to-end** — 5 device Android × full
   regression suite (15+ spec) chạy real, không simulated. Allure
   consolidated report cho 5 session.
7. ✅ **ROI report data-real** — `docs/m6-roi-report.md` §3 trend table fill
   số thật từ Influx (4 tuần data) — KHÔNG còn placeholder `_TBD_` /
   `_fill_`. Ratio + net savings có ý nghĩa.
8. ✅ **Tier rating audit doc** — `docs/m7-tier-rating.md` map từng feature
   framework vào Tier 1-4 với evidence link. Tier 1+2 ≥ 80%.
9. ✅ **All M1-M6 debt closed** — D5, D6, D7 (proposed RCA), D8 (proposed
   RCA), visual hook bug, Task 11 KPI sustain, Task 12 M5 verify-only,
   M5 sub-points 4 archived. Debt log Status column toàn 🟢.

---

## 3. Scope

### In scope

- **Validation infrastructure:** stability gate, accuracy benchmarks,
  calibration harnesses (NOT new test framework features).
- **Real-data backfill:** ROI, KPI, classifier — replace placeholder bằng
  measured numbers.
- **iOS promote:** spike (1 spec) → production (5 spec, 2 device).
- **BS matrix execution:** đã code M6, chạy thật end-to-end.
- **Debt closure batch:** D5 + D6 + D7 + D8 + visual hook bug + KPI
  sustain + M5 sub-points.
- **Tier rating audit:** honest doc map feature → Tier với evidence.

### Out of scope (explicit)

- ❌ **New core features** — KHÔNG add Assertion Contract layer mới, KHÔNG
  add skill mới. M7 là validation, không phải build.
- ❌ **Accessibility test** (TalkBack/VoiceOver) — promote sang M8 charter.
  Lý do: cần research a11y test framework + integrate, scope ≥ 1 sprint.
- ❌ **Security test** (MASVS, OWASP mobile) — defer M9+.
- ❌ **Localization test** (i18n verify) — defer M9+.
- ❌ **Mutation testing** — optional, không block claim "production-proven".
- ❌ **Chaos / resilience testing** — defer M8+.
- ❌ **iOS regression full** (15+ spec) — promote từ spike → smoke (5 spec)
  là đủ Tier 2; full regression là M8+ scope.
- ❌ **Backend Pact provider verification migrate** — M6 Decision 2 nói
  "M7+ migrate" — defer M8+ khi có backend team coordinate.

## 4. Technical decisions

### Decision 1: Self-heal benchmark methodology

- **Question:** Đo accuracy AI suggest locator như thế nào?
- **Options considered:**
  - **Option A — Inject 30 fake locator drift** trên Sauce Demo (rename
    accessibility ID, đổi cấu trúc XML): pros — controlled, reproducible;
    cons — không phản ánh real-world drift pattern.
  - **Option B — Mine git log** find 30 historical real drift fix qua
    `fix(locator):` commit grep: pros — real-world; cons — chưa có 30 fix
    trong git history (project mới).
  - **Option C — Hybrid:** 20 inject + 10 historical (nếu có).
- **Decision:** **Option A** với 30 inject controlled. M7 first benchmark
  thiết lập baseline; M8+ re-run với historical data khi git history accumulate.
- **Rationale:** Reproducibility quan trọng cho benchmark; inject pattern
  cover 80% drift type (rename, attribute change, structure shift).

### Decision 2: LLM classifier calibration corpus

- **Question:** Lấy 50 fail mẫu từ đâu để label manual + tune threshold?
- **Options considered:**
  - **Option A —** Generate synthetic fail bằng Chaos injection: pros —
    diverse; cons — không real-world distribution.
  - **Option B —** Run regression suite 14 ngày liên tục với artificial
    flaky injection (network throttle, account exhaust): pros — real-ish
    distribution; cons — labor-intensive.
  - **Option C —** Combine Sauce Demo + 1 internal app fail history qua
    git log + Allure archived runs: pros — cheap; cons — phụ thuộc data
    có sẵn.
- **Decision:** **Option B (14-day artificial run)** trùng với Task 1
  (KPI sustain) → 1 mũi tên 2 đích. 14 ngày × ~15 run/ngày = 210 fail
  candidates → label 50 đa dạng nhất.
- **Rationale:** Reuse Task 1 effort, không tốn extra compute. Real-ish
  distribution.

### Decision 3: 20-run stability gate trigger

- **Question:** Khi nào gate kích hoạt? Mọi PR hay PR có `new-spec` label?
- **Options considered:**
  - **Option A — Mọi PR có file change trong `tests/`:** pros — automatic;
    cons — slow (mỗi PR + 20 run × 5 phút = 100 phút).
  - **Option B — Chỉ khi PR có label `new-spec` (manual tag):** pros —
    fast, opt-in; cons — engineer có thể quên.
  - **Option C — Auto-detect spec mới qua git diff `+++ tests/.../*.spec.ts`
    new file:** pros — automatic + scoped; cons — file rename edge case.
- **Decision:** **Option C** — auto-detect new spec file qua git diff. PR
  chỉ modify spec cũ → skip gate. PR add spec mới → block merge tới khi
  pass 19/20.
- **Rationale:** Tự động + đúng scope (chỉ test stability spec mới, không
  test cũ đã proven). Edge case rename → manual override label
  `skip-stability-gate` với 1 reviewer approve.

### Decision 4: iOS device matrix M7

- **Question:** 2 iOS device hay 5 device?
- **Options considered:**
  - **Option A — 5 device** (iPhone 14, iPhone 15, iPhone SE 3, iPad mini,
    iPad Pro): pros — comprehensive; cons — BS quota burn 5×, slow.
  - **Option B — 2 device** (iPhone 14, iPhone 15): pros — đủ Tier 2
    promote, low cost.
  - **Option C — 3 device + 1 iPad** (iPhone 14, 15, iPad mini): pros —
    cover form factor; cons — iPad app khác layout cần extra fixture.
- **Decision:** **Option B (2 iPhone)**. Promote spike → Tier 2 chỉ cần
  prove cross-platform, không cần full coverage. iPad scope creep, iPhone
  SE redundant với iPhone 14.
- **Rationale:** M7 validation milestone không phải coverage milestone.
  Full iOS matrix defer M8+ với plan riêng `M8-cross-platform-coverage.md`.

### Decision 5: Tier rating audit ownership

- **Question:** Ai assess Tier rating cho từng feature — Phuc tự assess
  hay external review?
- **Options considered:**
  - **Option A — Phuc tự assess:** pros — fast; cons — bias confirmation.
  - **Option B — Pair-review** với 1 senior eng khác (peer review): pros
    — objective; cons — Phuc solo, không có peer.
  - **Option C — Self-assess + claude-code review** (em check evidence
    link mỗi entry, flag claim không có evidence): pros — semi-objective;
    cons — em không phải human peer.
- **Decision:** **Option C** — Phuc draft, em review evidence link cho
  từng claim. Mỗi entry phải có:
  ```
  Tier: 1 | 2 | 3 | 4
  Evidence: <file path / commit SHA / Allure run URL / data point>
  Validated date: <YYYY-MM-DD>
  ```
  Không có evidence → tự động Tier 3.
- **Rationale:** Solo dev không có peer; evidence-link rule loại bias
  bằng artifact requirement.

### Decision 6: M7 sustain window length — 14 hay 21 ngày?

- **Question:** Reuse M6 14d hay extend 21d cho M7?
- **Decision:** **14 ngày** (reuse M6 setup). 21 ngày scope creep, 14d
  đủ statistical power cho 200+ run.
- **Rationale:** M6 KPI gate đã thiết kế 14d window — không thay đổi
  threshold giữa milestone gây dashboard re-config.

### Decision 7: Debt closure timing trong M7

- **Question:** Đóng debt sprint 1 hay sprint cuối M7?
- **Decision:** **Sprint 1 (tuần 1)** — đóng D5+D6+visual hook bug+M5
  sub-points 4 trước khi start validation work. Lý do: validation cần
  framework ở stable state, đóng debt trước tránh noise trong benchmark
  data.
- **Rationale:** Per Decision 10 M5 (debt consolidation policy) — verify-only
  debt purge ở milestone closure boundary. M6 closure đã consolidate, M7
  mở đầu = batch 2.

---

## 5. Task breakdown

| # | Task | Deliverable file | Estimate | Status | Skill / Owner |
|---|------|------------------|----------|--------|---------------|
| 1 | M1-M6 debt closure batch (D5+D6+visual hook+M5 sub-points) | Update Debt log + closure evidence files | 8h | ⬜ | Phuc + `/test-implement` |
| 2 | 14-day sustain run với data thật (cron nightly + manual smoke ≥ 5/day) | Influx data + Grafana panel populated 14d | calendar-bound | ⬜ | Phuc (manual schedule) |
| 3 | Self-heal accuracy benchmark — inject 30 drift, measure precision/recall | `docs/m7-self-heal-benchmark.md` + `scripts/inject-locator-drift.cjs` | 12h | ⬜ | `/test-review` + Phuc |
| 4 | LLM classifier calibration — label 50 fail, tune threshold | `docs/m7-llm-calibration.md` + `tmp/m7-classifier-corpus.json` | 16h | ⬜ | `/failure-rca` + Phuc |
| 5 | 20-run stability gate CI workflow auto-detect new spec | `.github/workflows/stability-gate.yml` + `scripts/detect-new-spec.cjs` | 6h | ⬜ | `/test-implement` |
| 6 | iOS production promote (1 spike → 5 spec, 2 device) | `tests/smoke/*.ios.spec.ts` (4 spec mới) + `wdio.bs.ios.ts` extend | 14h | ⬜ | `/test-implement` (after Phuc upload IPA) |
| 7 | BS matrix full regression end-to-end (5 device × 15 spec) | Allure consolidated report + `docs/m7-bs-matrix-evidence.md` | 8h (BS quota burn) | ⬜ | Phuc (manual run) |
| 8 | ROI report data backfill (Influx → fill Section 3 trend table) | `docs/m6-roi-report.md` updated với 4 tuần real data | 3h | ⬜ | Phuc |
| 9 | Visual hook bug fix (testAccount lease `before` → `beforeEach`) | `tests/visual/screens-visual.spec.ts:<line>` | 2h | ⬜ | `/test-implement` |
| 10 | Audit perf/visual contracts env-aware threshold (D7) | All `AC_PERF_*.yaml` + `AC_VISUAL_*.yaml` audit | 4h | ⬜ | `/assertion-contract` |
| 11 | Document emulator perf gap multiplier (D8) | `docs/runbook-operations.md` §3.2 + `.env.example` block | 1h | ⬜ | Phuc |
| 12 | `fix(flaky):` commit lint hook (Husky pre-commit + commitlint rule) | `.husky/commit-msg` + `commitlint.config.cjs` | 3h | ⬜ | `/test-implement` |
| 13 | Tier rating audit doc — every feature mapped Tier 1-4 với evidence | `docs/m7-tier-rating.md` | 6h | ⬜ | Phuc draft + Claude review |
| 14 | M7 acceptance runbook + closure evidence | `docs/runbook-M7-acceptance.md` + `docs/m7-closure-evidence.md` | 4h | ⬜ | Phuc |

**Total estimate:** ~87h thực + 14d calendar-bound (Task 2). Phù hợp 5
tuần solo dev (~18-20h/tuần).

## 6. Dependencies

### Upstream (must finish first)

- [x] M5 done — Influx + KPI dashboard infra (calibration corpus depends on Task 2 data).
- [x] M6 done — BS matrix code, iOS spike, ROI placeholder, visual baseline (Task 6, 7, 8, 9 depend).
- [ ] M6 closure batch sign-off — D5+D6 closed, KPI 2-week sustain initiated. M7 Task 2 calendar starts ngay sau M6 closure.
- [ ] Phuc upload IPA iOS lên BS App Automate (Task 6 prereq).
- [ ] Phuc fill `LLM_API_KEY` (Gemini) — đã có nhưng cần verify budget headroom cho Task 4 calibration (~50 LLM call estimate $0.5).

### Downstream (block these)

- M8+ (whatever next milestone) — block tới khi M7 done. Lý do: claim
  "production-proven" phải có trước khi expand scope (a11y, security, full iOS).

### External dependencies

- **BrowserStack quota:** Task 6 (iOS) + Task 7 (Android matrix) ước tính
  150 min BS time. Free tier 100 min đã dùng M6 → cần upgrade trial hoặc
  pay-as-you-go (~$30 USD).
- **LLM budget Gemini:** Task 4 estimate 200 call × ~3K token ≈ $0.30
  (well within `LLM_BUDGET_MONTHLY_USD=20`).
- **No backend coordination** — M7 không touch Pact provider verification
  (defer M8+).

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 14d sustain run gặp infra outage giữa chừng → green days < 10/14 fail acceptance | M | H | Task 2 reset clock 1 lần, infra outage ngày đó count `--soft`. Nếu reset > 1 lần → revisit threshold (decision 5 M6 đã pre-empt với 70% threshold). |
| Self-heal accuracy thực tế < 70% (lower than claim) | M | M | Báo cáo honest trong benchmark doc; **không** silently raise threshold để pass. Lessons learned input cho M8+ self-heal v2. Spec self-heal value claim revise xuống số thật. |
| LLM classifier calibration corpus thiên lệch (Sauce Demo fail pattern không general) | H | M | Document corpus bias trong calibration report; classifier accuracy claim "Sauce Demo dataset" thay vì "general production". M9+ re-calibrate khi có internal app data. |
| iOS BS run fail vì IPA build issue (Sauce Demo iOS app outdated, deprecation) | M | M | Fallback: skip iOS Task 6, document gap, defer M8. Spike doc đã warn iOS gap (LogCapture). |
| BS quota burn vượt budget — không đủ trial 150 min | H | L | Pay-as-you-go ~$30; Phuc approve trước khi run Task 7. Sequential mode tiết kiệm vs parallel. |
| Phuc bandwidth — solo dev 87h work + manual run | H | M | Spread 5 tuần (~18h/tuần realistic). Task 2 calendar-bound chạy parallel với task implement. |
| Tier rating audit reveal > 50% Tier 3 không thể move sang Tier 2 trong 5 tuần | M | H | Honest doc — claim "production-proven architecture, Tier 2 validation Q3" thay vì over-promise. M7 mục tiêu ≥ 80% Tier 1+2; nếu chỉ đạt 65-70% → phase 7.5 plan extension. |

## 8. Test plan (verify deliverables)

- [ ] Unit test cho `scripts/inject-locator-drift.cjs` đạt coverage > 80%.
- [ ] Unit test cho `scripts/detect-new-spec.cjs` cover edge case (rename, delete, move).
- [ ] Integration test: stability gate workflow trigger trên test PR add 1 spec mới — verify 20× run launched.
- [ ] Integration test: stability gate workflow skip trên PR chỉ modify spec cũ.
- [ ] Manual smoke: 14d sustain run nửa chừng (day 7) → spot check Grafana panel populate đúng.
- [ ] Manual smoke: self-heal benchmark inject 1 fake drift → verify AI suggest PR open + accuracy log.
- [ ] LLM calibration test set hold-out 10/50 → verify classifier accuracy ≥ 85% trên hold-out.
- [ ] Acceptance walkthrough 9 § trong section 2 pass với evidence file.

## 9. Rollback plan

Nếu phải hủy milestone giữa chừng:

- **Rollback debt closure (Task 1):** không rollback — debt closed một
  chiều. Nếu fix ra bug, mở debt mới với entry trong log.
- **Rollback stability gate (Task 5):** disable workflow file, không xóa
  — lý do: workflow infra reusable.
- **Rollback iOS production (Task 6):** revert spec files; iOS scope rollback
  về spike-only. Update `docs/spikes/ios-support.md` verdict = PARTIAL/FAIL.
- **Rollback BS matrix run (Task 7):** chỉ là execution, không có code change.
- **Rollback ROI backfill (Task 8):** git revert commit `docs(m6-roi):
  backfill 4-week real data` — restore placeholder.
- **Rollback tier rating audit (Task 13):** chỉ là doc — git revert.

## 10. Sign-off checklist

Trước khi chuyển status → 🔵 Plan ready:

- [ ] Goal + Done criteria khớp scope §3.
- [ ] Scope rõ ràng (in §3.1, out §3.2 với lý do).
- [ ] Technical decisions §4 (1-7) đã trả lời.
- [ ] Task breakdown §5 có owner + estimate cho cả 14 task.
- [ ] Dependencies §6 xác định (BS quota + LLM key + IPA upload).
- [ ] Risks §7 đã thảo luận với mitigation cụ thể.
- [ ] Phuc DN approve target start 2026-06-08.
- [ ] BS quota plan confirmed (free trial extend hoặc PAYG approve).

## 11. Status updates (weekly)

| Date | Update | Blockers |
|------|--------|----------|
| 2026-05-02 | Plan v0.1 draft created | Pending sign-off + M6 closure |

## 12. Plan revisions

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| — | — | — | — |

---

## 13. Debt log — M1-M6 outstanding (consolidated trong M7)

> Snapshot tại 2026-05-02. Source of truth: `ROADMAP.md` Debt log.
> M7 Task 1 đóng tất cả entry này; M7 closure verify Status column toàn 🟢.

| ID | Debt | Acquired | Originally repay in | Current status | M7 task close |
|----|------|----------|---------------------|----------------|---------------|
| **D5** | M4 acceptance sub-points 1+2+3+4 (branch protection + PR CI gate + force-fail block + nightly dispatch) chưa verify trên GitHub UI | M4 (2026-04-28) | M6 closure | 🟡 Open — branch + commits đã push, chỉ cần Phuc click UI 4 step screenshot | Task 1 |
| **D6** | M4 acceptance sub-point 6 (D4 real-device verify trên dev Android) chưa chạy thực | M4 (2026-04-28) | M6 closure | 🟡 Open — code đã ship, cần Phuc cắm device + run 1 lần đóng | Task 1 |
| **D7 (proposed)** | Audit toàn bộ Assertion Contract perf/visual để confirm tất cả threshold có env override hook | M6 (2026-05-01) — flagged trong RCA TC_PERF_LOGIN_001 | M7 sprint 1 | 📝 Proposed (chưa add vào ROADMAP Debt log) | Task 10 |
| **D8 (proposed)** | Document emulator vs real device perf gap multiplier (4-5x) trong runbook + `.env.example` | M6 (2026-05-01) — flagged trong RCA TC_PERF_LOGIN_001 | M6 closure batch | 📝 Proposed | Task 11 |
| **Visual hook bug** | M6 Task 2 `tests/visual/screens-visual.spec.ts` dùng `before` hook nhưng `globalThis.testAccount` chỉ set trong `beforeEach` → hook fail | M6 (2026-05-01) — flagged trong demo run | M6 closure batch | 🟡 Open — chưa fix | Task 9 |
| **Task 11 (M6)** | KPI 14-day sustained verification chưa chạy với data thật (gate là theoretical) | M6 (2026-05-01) | M6 closure (calendar-bound) | 🟡 Open — calendar wait | Task 2 |
| **Task 12 (M6)** | M5 verify-only closure batch (sub-points 2/4/5/7) chưa walkthrough manual | M5 (2026-04-29) → M6 batch | M6 closure | 🟡 Open — chờ KPI dashboard có data | Task 1 |
| **Self-heal vibe-spec** | Self-heal AI accuracy claim chưa benchmark, value tuyên bố không validate | M5 (2026-04-29) | M7 (proposed via tier audit) | 📝 Proposed (chưa explicit log) | Task 3 |
| **LLM classifier vibe-spec** | LLM confidence threshold ≥ 0.8 chưa calibrate với corpus thật | M5 (2026-04-29) | M7 (proposed) | 📝 Proposed | Task 4 |
| **20-run stability gate** | Spec §6.4 yêu cầu nhưng CI chưa auto-enforce | M2 (2026-04-27) | Defer indefinite → M7 | 📝 Proposed | Task 5 |
| **iOS shelfware** | M6 Task 8 spike code shipped nhưng chưa chạy real, framework Tier 4 | M6 (2026-05-01) | M7 promote | 📝 Proposed | Task 6 |
| **BS matrix shelfware** | M6 Task 4 code shipped nhưng matrix end-to-end chưa run thật | M6 (2026-05-01) | M7 execute | 📝 Proposed | Task 7 |
| **ROI placeholder** | `docs/m6-roi-report.md` §3 trend table toàn `_TBD_` / `_fill_` | M6 (2026-05-01) | M7 (calendar-bound) | 📝 Proposed | Task 8 |
| **`fix(flaky):` discipline gap** | Convention chưa enforced — engineer có thể quên tag → maintenance cost tracker miss data | M6 (2026-05-01) | M7 (lint hook) | 📝 Proposed | Task 12 |

**Total open/proposed:** 14 entry. M7 Task 1 + 3-12 đóng 13 entry; entry "Task 12 M6" đóng cùng với Task 1 ở đây (M7 Task 1 = M6 Task 12 walkthrough).

**ROADMAP.md update required (M7 plan sign-off):**

1. Add row M7 vào "Tổng quan tiến độ" table.
2. Add D7 + D8 + 6 vibe-spec debt vào Debt log với "Repay in: M7".
3. Add M7 Decisions log entry sau sign-off.
4. Update "Cập nhật roadmap" rule: M7 closure = "production-proven" claim eligible.

---

## 14. Closure

Điền khi mark milestone DONE:

- [ ] Tất cả 14 task §5 status = 🟢
- [ ] Acceptance test 9 § trong §2 pass (kèm evidence)
- [ ] 14 debt entry §13 toàn Status 🟢 trong ROADMAP Debt log
- [ ] Tier rating audit doc cho thấy ≥ 80% Tier 1+2
- [ ] Self-heal benchmark report committed
- [ ] LLM calibration report committed
- [ ] ROI report Section 3 fill data thật
- [ ] M7 Decisions log copied vào `ROADMAP.md`
- [ ] Lessons learned cho milestone tiếp theo (M8+):
  - <lesson 1 — vd. "tier audit phát hiện X feature claim không có evidence">
  - <lesson 2 — vd. "self-heal precision lower than claimed → revise marketing copy">
  - <lesson 3 — vd. "calibration corpus bias toward Sauce Demo, M9 cần internal data">

---

## 15. References

- M6 plan: `docs/plans/M6-optimization.md` (parent + scope context)
- M6 acceptance runbook: `docs/runbook-M6-acceptance.md` (template cho M7 acceptance)
- ROI report: `docs/m6-roi-report.md` (Task 8 backfill target)
- iOS spike: `docs/spikes/ios-support.md` (Task 6 promote source)
- RCA TC_PERF_LOGIN_001: `docs/rca/2026-05-01-TC_PERF_LOGIN_001.md` (D7+D8 origin)
- Operational runbook: `docs/runbook-operations.md` (Task 11 update target)
- Framework usage guide: `docs/framework-usage-guide.md` (cross-ref Tier rating audit)
- ROADMAP: `ROADMAP.md` (debt log + decisions log update target)
