# M6 ROI Report — Mobile Automation Framework

**Author:** Phuc DN
**Generated:** 2026-05-01 (initial draft, refresh weekly during M6 sustain window)
**Plan ref:** [M6 plan §4 Decision 7](plans/M6-optimization.md)

---

## 1. Formula (Decision 7 — critical flow weighted)

```
hours_saved = SUM_critical_flow( manual_minutes × actual_runs × efficiency_factor )
            ÷ 60
hours_spent = automated_minutes × actual_runs ÷ 60
            + maintenance_hours          (← from scripts/maintenance-cost.cjs)
            + framework_dev_amortized    (← M1-M6 build cost / 12 months)

ROI ratio   = hours_saved / hours_spent
Net savings = hours_saved − hours_spent
```

**Constants (defensible defaults — refine khi có data thật):**

| Variable | Value | Source |
|----------|-------|--------|
| efficiency_factor | 0.7 | Decision 7 — assumes manual run wouldn't catch 100% bugs (industry baseline Capgemini 70-80%). |
| framework_dev_amortized | 240h / 12mo = 20h/mo | M1-M6 build estimate ≈ 200-280h solo dev (M1 6h + M2 30h + M3 35h + M4 50h + M5 65h + M6 60h). |

**Critical flow manual time estimates:**

| Flow | Manual minutes | Why this number |
|------|----------------|-----------------|
| Login (TC_LOGIN_001) | 3 | Open app + type creds + tap login + verify cart icon = ~3 phút (Phuc thực tế đo M1 acceptance). |
| Add to cart (TC_CART_001) | 5 | Login + browse + select product + add + verify badge = ~5 phút. |
| Checkout (TC_CHECKOUT_001) | 8 | Login + add items + checkout form + complete = ~8 phút. |
| Search/filter (TC_SEARCH_001) | 4 | Login + tap menu + sort + verify ordering = ~4 phút. |

## 2. Sample calculation (placeholder — fill khi M6 sustain window xong)

**Window:** 4 tuần (refresh weekly khi sustain window chạy).
**Data source:** Influx `test_run` count + `pipeline_duration`.

| Metric | Value | Source |
|--------|-------|--------|
| critical_flow_runs (total, 4 weeks) | _TBD_ | `count(test_run where suite=smoke|regression)` |
| automated_minutes_per_run | _TBD_ | `mean(pipeline_duration where workflow=ci.yml) ÷ 60` |
| maintenance_hours | _TBD_ | `scripts/maintenance-cost.cjs` 30d total |
| framework_dev_amortized | 20h | constant |

**Computed (placeholder values — replace với Influx number):**

```
hours_saved  = (3 × 100 + 5 × 80 + 8 × 60 + 4 × 80) × 0.7 ÷ 60 = ~17h
hours_spent  = 8 × (100 + 80 + 60 + 80) ÷ 60 + 6 + 20 = ~63h
ROI ratio    = 17 / 63 = 0.27   ← chưa break-even ở 4-tuần
Net savings  = -46h              ← framework đang đầu tư, chưa thu hồi
```

> **Đọc số:** ROI < 1 trong 4 tuần đầu là **bình thường và expected** vì framework dev cost chưa amortize hết. Break-even ước tính ở tháng 6-9 (sau khi run ổn 6+ tháng và critical_flow_runs tăng linear).

## 3. Trend over 4-week window

| Week | hours_saved | hours_spent | ratio | net |
|------|-------------|-------------|-------|-----|
| W1 | _fill_ | _fill_ | _fill_ | _fill_ |
| W2 | _fill_ | _fill_ | _fill_ | _fill_ |
| W3 | _fill_ | _fill_ | _fill_ | _fill_ |
| W4 | _fill_ | _fill_ | _fill_ | _fill_ |

**Update cadence:** mỗi thứ 2 tuần (Phuc kéo data từ Grafana panel "Daily KPI breakdown" + chạy `node scripts/maintenance-cost.cjs` paste vào table).

## 4. Sensitivity analysis

ROI nhạy với 3 biến:

1. **actual_runs** — chạy nhiều → ratio tăng tuyến tính. Mục tiêu: ≥ 5 PR/day + 1 nightly = ~210 runs/4-week.
2. **maintenance_hours** — flaky-fix nhiều → ratio giảm. Mục tiêu: < 4h/sprint (Decision 6 convention `fix(flaky):`).
3. **efficiency_factor** — nếu test catch bug thật → 0.7 đúng; nếu chỉ catch flaky → 0.3-0.4. Adjust khi RCA history đủ data (M6 sprint cuối review).

## 5. Source data references

- `reports/analytics/maintenance-cost.json` — refresh weekly via `node scripts/maintenance-cost.cjs`.
- `reports/analytics/pass-rate-forecast.json` — `node scripts/analytics-trend.cjs`.
- Grafana dashboard `m6-kpi-sustained` panel "Daily KPI breakdown" — count runs/day.
- Git log filter `fix(flaky):` (Decision 6).

## 6. Limitations & honest disclaimers

- **Manual estimate là estimate**: 3 phút login chưa chắc đúng cho user thật người mới (có thể 5-10 phút). Conservative side: dùng số thấp.
- **Efficiency factor 0.7 là industry, không phải project**: refine khi có 3+ tháng RCA data show test catch real bug ratio.
- **Framework dev cost không refresh**: nếu M7+ tăng scope (full iOS), thêm vào numerator amortized.
- **Không count opportunity cost**: bug escape production cost (1 P0 = $X downtime) chưa quantify trong report — separate analysis nếu Phuc cần justify budget với leadership.

## 7. When to revisit this report

- **Weekly** trong M6 sustain window (Task 11).
- **Monthly** sau M6 closure khi framework đã production stable.
- **Khi scope thay đổi**: add iOS, thêm critical flow → re-run Section 1 formula với constant mới.
