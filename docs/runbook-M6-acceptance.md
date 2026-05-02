# Runbook — M6 Acceptance Test (Phuc DN sign-off)

> Plan ref: `docs/plans/M6-optimization.md` §2 done-criteria (8 sub-points).
> Mục tiêu: walk-through 8 acceptance test xác nhận M6 🟢 trước khi mark milestone DONE.
>
> **Pre-req:**
> - Repo cloned + `npm ci`, Node 22.
> - Docker Desktop running (cho §1 KPI dashboard).
> - GH CLI `gh` authenticated (cho §8 closure batch).
> - `.env.local` đã fill: `BS_USERNAME`, `BS_ACCESS_KEY`, `BS_APP_URL`, `LLM_API_KEY`.
> - InfluxDB đã có ≥ 14 ngày data thực tế (sustain window Task 11 đã chạy xong).

---

## §1 KPI dashboard 2-week sustained — 7 KPI green ≥ 10/14 ngày

**Verify:**

```bash
docker compose -f infra/observability/docker-compose.yaml up -d
xdg-open 'http://127.0.0.1:3000/d/m6-kpi-sustained'   # Linux
# Mac:    open  'http://127.0.0.1:3000/d/m6-kpi-sustained'
# Win:    start 'http://127.0.0.1:3000/d/m6-kpi-sustained'
```

Đọc 4 panel critical (auto-gated) + 3 panel manual + panel **"Green days / 14"**:

- [ ] Genuine pass rate ≥ 95% (panel 1).
- [ ] Flaky rate < 3% (panel 2).
- [ ] False-positive < 1% (panel 3).
- [ ] PR pipeline P95 < 600s (panel 4).
- [ ] Critical flow coverage = 100% (panel 5, manual).
- [ ] MTTD < 30 min (panel 6, manual).
- [ ] MTTF P0 < 4h (panel 7, manual).
- [ ] Regression P95 < 1800s (panel 8).
- [ ] **Green days/14 ≥ 10** (panel 11) — Decision 5 sustain gate.

**Evidence:** screenshot panel 11 + panel "Daily KPI breakdown" (panel 12) → archive trong `docs/m6-closure-evidence.md` §1.

---

## §2 Performance test active — break SLA → fail correctly

**Verify positive (within SLA):**

```bash
npm run test:perf
```

Expected: 3 specs pass (login, checkout, search), Allure attach `perf_summary` step với p50/p95/max ms.

**Verify negative (force break SLA):**

```bash
PERF_LOGIN_SLA_MS=1 npm run test:perf -- --spec tests/perf/login-perf.spec.ts
```

Expected: spec FAIL, error message contain `p95 ... exceeds threshold 1ms`, route step 7 (RCA) per spec §6.2.

**Evidence:** Allure HTML attach screenshot pass + 1 fail run. Archive đường dẫn → `m6-closure-evidence.md` §2.

---

## §3 Visual regression baseline — 5 screen + diff threshold fail correctly

**Verify positive:**

```bash
npm run test:visual
```

Expected: 5 specs pass (login_screen → checkout_complete), Allure attach `actual` PNG cho mỗi step.

**Verify negative (force diff):**

```bash
# Force diff: edit 1 baseline pixel manually rồi re-run
node -e "
  const fs=require('fs'),{PNG}=require('pngjs'),p='tests/fixtures/visual/baselines/login_screen.png';
  const png=PNG.sync.read(fs.readFileSync(p));
  png.data[0]=255;png.data[1]=0;png.data[2]=0;
  fs.writeFileSync(p,PNG.sync.write(png));
"
npm run test:visual -- --spec tests/visual/screens-visual.spec.ts
```

Expected: TC_VIS_001 FAIL, error contain `mismatch ... > threshold`, diff PNG attach Allure (red highlight). **Restore baseline** sau khi verify: `git checkout tests/fixtures/visual/baselines/`.

**Evidence:** screenshot Allure 5 pass + 1 fail diff → `m6-closure-evidence.md` §3.

---

## §4 Cross-device matrix — 5 device smoke pass on BS

**Verify:**

```bash
# Phuc fill .env.local trước khi run:
#   BS_USERNAME, BS_ACCESS_KEY, BS_APP_URL (bs://...)

# Sequential mode (BS quota safe — 5 device chạy tuần tự ~10 phút)
npm run test:bs:matrix -- --sequential
```

Expected:
- 5 device PASS (pixel-7-a13, pixel-6-a12, galaxy-s22-a12, oneplus-11-a13, pixel-8-a14).
- Console summary: `Total: 5 device | 5 pass | 0 fail`.
- BS dashboard https://app-automate.browserstack.com show 5 session với buildName `m6-bs-...`.

**Fallback (per Decision 3):** nếu BS quota cạn / setup blocker → 1 real device cắm trực tiếp + 0-1 farm = scope giảm. Document fallback trong `m6-closure-evidence.md`.

**Evidence:** BS dashboard screenshot 5 session + npm output → `m6-closure-evidence.md` §4.

---

## §5 Pact contract test — 2 contract, CI fail on consumer break

**Verify positive:**

```bash
npm run test:pact
```

Expected: 7 interactions pass (3 auth + 4 cart). Files generated `pacts/mobile-app-auth-service.json` + `pacts/mobile-app-cart-service.json`.

**Verify negative (force break):**

```bash
# Edit 1 spec để gửi sai shape → re-run
# Vd. tests/pact/auth-consumer.spec.ts: change `password: 'secret_sauce'` → `password: 123` (number not string)
npm run test:pact
```

Expected: spec FAIL với pact mismatch error log. **Revert** sau khi verify: `git checkout tests/pact/`.

**Evidence:** 2 pact JSON file + 1 fail run log → `m6-closure-evidence.md` §5.

---

## §6 Test analytics — 3 script work end-to-end

```bash
INFLUX_URL=http://127.0.0.1:8086 \
INFLUX_TOKEN=$INFLUX_ADMIN_TOKEN \
INFLUX_ORG=mobile-automation \
INFLUX_BUCKET=test-runs \
node scripts/analytics-trend.cjs
node scripts/regression-risk.cjs
node scripts/maintenance-cost.cjs
```

Expected:
- `reports/analytics/pass-rate-forecast.json` exists, có 7 forecast date.
- `reports/analytics/regression-risk.json` có top3 + all.
- `reports/analytics/maintenance-cost.json` có total_hours + per-commit list.

**Evidence:** 3 JSON file commit-able evidence → reference path trong `m6-closure-evidence.md` §6.

---

## §7 ROI report committed + at least 1 weekly refresh

```bash
cat docs/m6-roi-report.md
git log --since="2 weeks ago" -- docs/m6-roi-report.md
```

Expected:
- File exists.
- Có ít nhất 1 commit refresh weekly trong window 2 tuần (Phuc fill section §3 trend table với data thật từ Influx).

**Evidence:** git log paste vào `m6-closure-evidence.md` §7.

---

## §8 Debt closure batch — D5+D6 + 4 M5 verify-only sub-points

### §8.1 D5 (M4 Task 7 — feature-flag PR walkthrough)

```bash
# Phuc walk through quy trình tạo PR có feature flag, follow docs/runbook-pr-merge-gate.md
```
Evidence: 1 GitHub PR link với label `feature-flag` + screenshot hover branch protection rule UI.

### §8.2 D6 (M4 Task 13 — D4 Kotlin APK install on real device)

```bash
adb devices
./gradlew :sample-app:installDebug
adb shell am start -n com.example.sample/.MainActivity
```
Evidence: screenshot `adb` output + app screenshot trên device.

### §8.3 M5 sub-point 2 (dashboard live data)

Verify panel 14d window all populated (no "No data" message). Screenshot 6 panel.

### §8.4 M5 sub-point 4 (self-heal PR end-to-end)

```bash
# Trigger 1 self-heal PR: introduce broken locator trong 1 page object
# Wait CI fail → wait self-heal-pr.cjs scheduled run
```
Evidence: GH PR link self-heal bot create + diff (locator suggested change).

### §8.5 M5 sub-point 5 (Allure URL share)

Verify GH Pages publish allure-report. Open URL `https://<owner>.github.io/<repo>/allure/<run_id>/`.

Evidence: link + screenshot landing page.

### §8.6 M5 sub-point 7 (notify-fail.yml fan-out)

Force 1 fail trên main → verify GH Issue auto-created với label `ci-fail-auto` trong < 5 phút.

Evidence: Issue link + screenshot.

---

## Closure summary

Sau khi 8 §1-§8 đều ✅:

- [ ] Update `ROADMAP.md` M6 row → 🟢 Done với `Actual end` = today's date.
- [ ] Update `docs/plans/M6-optimization.md` §13 Closure section: tick all checkbox + paste lessons learned.
- [ ] Update D5 + D6 row trong `ROADMAP.md` Debt log → 🟢 Repaid.
- [ ] Mark M5 verify-only debt 4 sub-points archived trong `docs/m5-closure-evidence.md`.
- [ ] Commit single `M6 closure: 🟢 done + debt repaid + lessons learned` với evidence files.

---

## References

- M6 plan: `docs/plans/M6-optimization.md`
- KPI dashboard: `infra/observability/grafana-dashboards/m6-kpi-sustained.json`
- KPI gate script: `scripts/check-kpi-window.cjs`
- Operational runbook (post-M6 daily ops): `docs/runbook-operations.md`
