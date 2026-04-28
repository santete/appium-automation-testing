---
name: test-validate
description: Validate test result đa tầng (UI+API+State) để xác định GENUINE_PASS / FALSE_PASS / FLAKY / BUG. Dùng khi cần phân tích kết quả run test và ra verdict. Map vào Step 6 spec — bước CRITICAL để tránh false confidence.
---

# Test Result Validation

Map vào **Step 6 — Validate Result (CRITICAL)** spec `automation_testing_requirement.md`.

> Spec §1.3: "PASS ≠ Correct. Pass chỉ có nghĩa 'không có gì fail', không có nghĩa 'đúng'."

## Khi invoke skill này

- Có 1 hoặc nhiều test run output cần validate.
- User nói "test này pass nhưng có thật không / validate kết quả / xác định verdict".
- Sau mỗi run trong CI để classify trước khi report.

## Quy trình bắt buộc

### 1. Đọc evidence multi-layer
- UI evidence: screenshot, page state dump.
- API evidence: HAR file, status codes, response bodies.
- State evidence: secure storage dump, DB snapshot, session state.
- Logs: console, app, crash.

**Nếu thiếu bất kỳ layer nào → verdict = `INSUFFICIENT_EVIDENCE`**, KHÔNG đoán PASS.

### 2. Áp Validation Decision Matrix (spec §3 step 6)

| UI | API | Data/State | Verdict |
|----|-----|------------|---------|
| ✅ Pass | ✅ Pass | ✅ Pass | **GENUINE_PASS** |
| ✅ Pass | ❌ Fail | any | **FALSE_PASS** ⚠️ (UI lừa) |
| ❌ Fail | ✅ Pass | ✅ Pass | **UI_BUG** |
| ✅ Pass | ✅ Pass | ❌ Fail | **DATA_BUG** / **STATE_BUG** |
| Intermittent | any | any | **FLAKY** → cần ≥10 runs để xác nhận |
| Timeout | Timeout | n/a | **ENV_INFRA_ISSUE** |

### 3. Cross-check với Assertion Contract

Đọc `src/contracts/AC_<scenario>.yaml`:
- Mỗi assertion id phải có evidence tương ứng.
- Critical fail → verdict không thể là PASS.
- High fail → verdict = `PASS_WITH_WARNINGS` (vẫn có thể chấp nhận, tùy policy).
- Negative assertion fail (no_crash, no_pii) → verdict = `FAIL` bất kể UI/API/State.

### 4. Output bắt buộc — Validation Report YAML

```yaml
test_id: TC_<DOMAIN>_<NNN>
run_id: <uuid>
timestamp: <ISO8601>
verdict: GENUINE_PASS | FALSE_PASS | FAIL | FLAKY | INSUFFICIENT_EVIDENCE | ENV_INFRA_ISSUE

layers:
  ui:
    status: pass | fail | error
    evidence: [<file paths>]
    failed_assertions: [<assertion ids>]
  api:
    status: pass | fail | error
    evidence: [<HAR / response files>]
    failed_assertions: [<assertion ids>]
  state:
    status: pass | fail | error
    evidence: [<storage dumps>]
    failed_assertions: [<assertion ids>]

negative_violations: [<assertion ids if any>]  # critical: no_crash, no_pii

root_layer: ui | api | state | infra | unknown
recommended_action:
  - <hành động cụ thể, không chung chung>
route_to_skill: failure-rca | none  # nếu không phải GENUINE_PASS thì route sang failure-rca
```

### 5. FLAKY detection rule

KHÔNG mark FLAKY chỉ vì 1 lần fail. Quy tắc:
- Run lại ≥10 lần với **cùng input + cùng env**.
- Pass rate trong [10%, 90%] → FLAKY.
- Pass rate < 10% → bug thật, không flaky.
- Pass rate > 90% → có thể accept với cảnh báo, hoặc tăng wait/retry.

### 6. Hành vi với từng verdict

| Verdict | Hành vi |
|---------|---------|
| GENUINE_PASS | Mark pass, archive evidence ngắn, route Step 7 (analyze for trend) |
| FALSE_PASS | **Cảnh báo NGHIÊM TRỌNG** — assertion contract sai → invoke `assertion-contract` để fix |
| UI_BUG / DATA_BUG | Route sang `failure-rca` với hint layer |
| FAIL (negative violation) | Block release, alert security/QA lead |
| FLAKY | Quarantine test + route `failure-rca` để fix root cause |
| ENV_INFRA_ISSUE | Route Step 3 (`test-data-setup`) hoặc DevOps |
| INSUFFICIENT_EVIDENCE | KHÔNG kết luận, yêu cầu rerun với observability đầy đủ |

## Anti-pattern (spec §9.4)

- ❌ Verdict = PASS chỉ vì exit code 0 / WDIO báo pass.
- ❌ Bỏ qua API/State layer vì "UI pass là đủ" → đây chính là FALSE_PASS trap.
- ❌ Mark FLAKY sau 1 lần fail mà không reproduce.
- ❌ Verdict không kèm evidence file path → không actionable.
- ❌ Kết luận GENUINE_PASS mà negative assertion (no_crash, no_pii) chưa kiểm tra.
