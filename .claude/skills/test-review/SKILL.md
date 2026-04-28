---
name: test-review
description: Review test code/test design theo Trustworthiness Pyramid (Reliable + Meaningful + Maintainable + Traceable) và scan anti-patterns từ §9 spec. Dùng khi cần đánh giá test có đủ trustworthy chưa, không chỉ "chạy được". Cross-cutting với mọi step.
---

# Test Trustworthiness Review

Map vào **§1.2 Trustworthiness Pyramid** + **§9 Anti-patterns** spec `automation_testing_requirement.md`.

> Spec §1.2: "Một test KHÔNG đủ cả 4 tầng → là **technical debt**, không phải tài sản."

## Khi invoke skill này

- Code review test mới hoặc PR test changes.
- User nói "review test này / có đủ trustworthy chưa / có anti-pattern không".
- Định kỳ audit suite hiện tại.
- Trước khi promote test từ smoke → regression hoặc add vào nightly.

## Quy trình review — 4 tầng pyramid

### Tầng 1 — Reliable (ổn định, ít flaky)

- [ ] KHÔNG có `browser.pause()` hoặc `setTimeout`/`sleep` bất kỳ.
- [ ] Tất cả wait đều có `timeoutMsg` mô tả điều kiện chờ.
- [ ] Không có magic timeout (constant > 5000 mà không có comment justify).
- [ ] Test không phụ thuộc thứ tự với test khác.
- [ ] `beforeEach` create fresh data, `afterEach` cleanup idempotent.
- [ ] Không có shared mutable state (global, file-scope `let`).
- [ ] Pass rate ≥ 95% trong 30 run gần nhất (nếu có history).

### Tầng 2 — Meaningful (đúng assertion, đúng scope)

- [ ] Có Assertion Contract YAML tương ứng (`src/contracts/AC_<id>.yaml`).
- [ ] Multi-layer: assertion ở ≥2 trong 3 layer (UI + API + State).
- [ ] Không chỉ dùng `isDisplayed()` — assert content cụ thể.
- [ ] Có negative assertions (no_crash, no_console_error, no_pii).
- [ ] Severity được phân loại (không all-critical).
- [ ] Test scope rõ ràng — KHÔNG test nhiều flow trong 1 test.
- [ ] Đúng tầng pyramid: critical flow mới đặt E2E, business logic đẩy xuống API test.

### Tầng 3 — Maintainable (dễ sửa khi app thay đổi)

- [ ] Locator dùng accessibility id (`~xxx`), tránh XPath.
- [ ] Page Object < 500 dòng (spec §9.2).
- [ ] Không hardcode URL, credential, endpoint, magic number.
- [ ] Page Object KHÔNG chứa assertion (assert ở spec layer).
- [ ] Đặt đúng folder theo §10.3 (`src/pages/`, `tests/smoke/`, ...).
- [ ] Có TypeScript type cho input/output (không `any`).
- [ ] Code có thể đọc trong 30s mà không cần comment giải thích.

### Tầng 4 — Traceable (biết tại sao pass/fail)

- [ ] Test có `test_id` link tới Test Scenario và Assertion Contract.
- [ ] On-fail tự động capture: screenshot, video (CI), HAR, console log.
- [ ] Step logs bật (timestamp + action + element + result).
- [ ] Failure có đủ evidence để invoke `failure-rca` mà không cần rerun.
- [ ] Assertion id unique → mapping được fail → root layer.

## Anti-pattern scan (spec §9)

### §9.1 Test Design

| Phát hiện | Severity | Fix |
|-----------|----------|-----|
| Chỉ assert `isDisplayed()` | High | Assert content cụ thể |
| Single-layer assertion (UI only) | Critical | Add API + State assertion |
| Test phụ thuộc thứ tự | Critical | Independent + isolated |
| Shared state giữa test | High | beforeEach/afterEach |
| Quá nhiều E2E ít API test | Medium | Move logic xuống API tier |

### §9.2 Implementation

| Phát hiện | Severity | Fix |
|-----------|----------|-----|
| `browser.pause(...)` | Critical | `waitUntil` |
| Hardcode locator/URL/creds | High | Config + env var |
| Page Object > 500 dòng | Medium | Split theo screen/feature |
| `try-catch` nuốt error | High | Log + re-throw |
| Magic numbers | Medium | Named constant |

### §9.3 Execution

| Phát hiện | Severity | Fix |
|-----------|----------|-----|
| Parallel run không isolation | Critical | Account pool + data isolation |
| Không cleanup test data | High | afterEach |
| Retry mù quáng (không log) | High | Retry có limit + log + alert flaky |
| Skip test fail thay vì fix | Critical | Quarantine + deadline |

### §9.4 Process

| Phát hiện | Severity | Fix |
|-----------|----------|-----|
| Chỉ nhìn PASS/FAIL không RCA | High | Invoke `failure-rca` cho mọi failure |
| Auto-apply self-healing | Critical | Human approve gate |
| Không update KB | Medium | Update `docs/flaky_kb.md` sau RCA |

## Output review report

```yaml
review_target: <file paths>
reviewed_at: <ISO8601>
overall_verdict: APPROVE | NEEDS_CHANGES | REJECT

trustworthiness:
  reliable: <PASS | FAIL>: <details>
  meaningful: <PASS | FAIL>: <details>
  maintainable: <PASS | FAIL>: <details>
  traceable: <PASS | FAIL>: <details>

anti_patterns_found:
  - section: §9.x
    pattern: <name>
    location: <file>:<line>
    severity: critical | high | medium
    fix_suggestion: <action>

required_actions:  # blocker — must fix before merge
  - <action>

recommended_actions:  # nice to have
  - <action>
```

## Block-merge rule

Verdict `REJECT` khi có bất kỳ điều kiện sau:
- ≥1 anti-pattern severity **critical**.
- Tầng Reliable hoặc Meaningful FAIL.
- Test không có Assertion Contract YAML tương ứng.
- Có `pause()` / hardcoded credential.

Verdict `NEEDS_CHANGES` khi tầng Maintainable hoặc Traceable FAIL.

## Anti-pattern của chính skill này

- ❌ Review chỉ nhìn syntax/style — bỏ qua trustworthiness.
- ❌ Approve test mới chưa có contract → tích lũy debt.
- ❌ Đếm số test thay vì chất lượng (spec §8.4 anti-KPI).
