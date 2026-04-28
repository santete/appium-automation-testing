---
name: assertion-contract
description: Design Assertion Contract YAML cho test case — định nghĩa positive/negative/performance assertions ở multi-layer (UI+API+State) với severity. Dùng khi đã có Test Scenario và cần thiết kế "đúng/sai" trước khi viết code. Map vào Step 2 + §5 spec.
---

# Assertion Contract Designer

Map vào **Step 2** + **§5 Assertion Contract Framework** spec `automation_testing_requirement.md`.

## Khi invoke skill này

- Đã có Test Scenario (output của skill `test-requirement`).
- Sắp implement test code → CẦN contract trước (spec §5: "Assertion phải được design từ Step 2, không phải nghĩ ra khi viết code ở Step 4").
- User nói "design contract / assertion cho TC_X".

## Nguyên tắc cốt lõi (KHÔNG ĐƯỢC VI PHẠM)

1. **Multi-layer bắt buộc:** mỗi contract phải có assertion ở ≥2 trong 3 layer (UI, API, State). Single-layer = false-pass risk (spec §6 Validation Decision Matrix).
2. **Negative assertions bắt buộc:** "những thứ KHÔNG được phép xảy ra" (no crash, no PII trong log, no console error). Đây là phần dễ bỏ quên nhất.
3. **Mỗi assertion phải có `severity`:** critical / high / medium / low. Severity quyết định verdict logic ở `test-validate`.
4. **Assertion phải có `id` unique** trong contract để route evidence và debug.

## Output bắt buộc — YAML contract

Lưu vào `src/contracts/<scenario_id>.yaml`:

```yaml
contract_id: AC_<DOMAIN>_<NNN>
test_scenario: TC_<DOMAIN>_<NNN>  # link tới Test Scenario
description: <one-line>

positive:
  ui_layer:
    - id: ui.<short_name>
      check: <điều kiện kiểm tra cụ thể, không chung chung>
      severity: critical | high | medium | low
  api_layer:
    - id: api.<short_name>
      check: <method path → status, schema, field value>
      severity: critical | high | medium | low
  state_layer:
    - id: state.<short_name>
      check: <storage / DB / session field>
      severity: critical | high | medium | low

negative:  # BẮT BUỘC, không được rỗng
  - id: neg.no_crash
    check: app.crashed == false
    severity: critical
  - id: neg.no_pii_in_logs
    check: logs NOT contains <password|token|pii>
    severity: critical
  - id: neg.no_console_error
    check: console.errors.length == 0
    severity: medium

performance:
  - id: perf.<flow>_duration
    check: time(<start_event> → <end_event>) < <ms>ms
    severity: high

visual:  # optional, chỉ cho UI critical
  - id: visual.<screen>_layout
    check: screenshot_diff(<screen>, baseline) < 1%
    severity: low
```

## Severity decision rules (spec §5.3)

| Severity | Khi áp dụng | Hành vi runtime |
|----------|-------------|-----------------|
| critical | Core business outcome (login redirect, payment success, security) | Stop test, mark FAIL |
| high | SLA, performance, important state | Continue, fail ở cuối |
| medium | Non-blocking quality (console error) | Continue, log warning |
| low | Visual diff nhỏ, info | Continue, info only |

## Workflow

1. Đọc Test Scenario tương ứng.
2. Cho mỗi `expected.ui/api/state`, viết ≥1 assertion với check cụ thể (KHÔNG dùng `isDisplayed()` chung chung — phải assert content).
3. Liệt kê negative tối thiểu: no_crash, no_console_error, no_pii_in_logs (security).
4. Performance: ít nhất 1 assertion cho flow chính nếu có SLA.
5. Schema validation cho mỗi API call (dùng Zod schema reference trong `check`).
6. Review: contract phải đủ để xác định FALSE_PASS — tức là nếu UI pass mà API/State fail thì verdict phải là FAIL.

## Anti-pattern (spec §9.1)

- ❌ `check: element.isDisplayed()` — không assert content cụ thể.
- ❌ Contract chỉ có UI layer → false pass khi backend lỗi.
- ❌ Bỏ section `negative` vì "không có gì phải kiểm tra" — luôn có (crash, log, PII).
- ❌ Severity all `critical` → mất ý nghĩa phân loại.
