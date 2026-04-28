---
name: test-requirement
description: Phân tích PRD/user story/acceptance criteria thành testable scenarios với testability assessment. Dùng khi user đưa requirement và muốn xác định "test gì, automate hay manual, expected behavior là gì". Map vào Step 1 trong spec automation_testing_requirement.md.
---

# Test Requirement Analysis

Map vào **Step 1** spec `automation_testing_requirement.md` §3.

## Khi invoke skill này

User đưa input dạng: PRD, user story, acceptance criteria, feature description, hoặc nói "phân tích requirement này để automate".

## Quy trình bắt buộc

### 1. Đọc spec section liên quan
Đọc `automation_testing_requirement.md` §3 step 1 để lấy đúng template Test Scenario.

### 2. Testability Assessment — chạy checklist trước khi propose automate

| Tiêu chí | Pass | Fail |
|----------|------|------|
| Có stable locator/API contract? | ✅ Automate | ❌ Manual |
| Test data reproducible? | ✅ Automate | ❌ Manual |
| Expected behavior deterministic? | ✅ Automate | ❌ Manual |
| Có thể reset state sau test? | ✅ Automate | ❌ Manual |
| ROI > effort maintain? | ✅ Automate | ❌ Manual |

**Nếu fail bất kỳ tiêu chí nào → đề xuất MANUAL, không tự ý mark AUTOMATABLE.**

### 3. Output bắt buộc — Test Scenario YAML

```yaml
scenario_id: TC_<DOMAIN>_<NNN>
flow: <tên flow>
priority: P0 | P1 | P2 | P3
testability: AUTOMATABLE | MANUAL_ONLY
testability_notes: <nếu MANUAL, giải thích lý do dựa trên checklist>

input:
  <field>: <value>

expected:
  ui:
    - <observable UI behavior>
  api:
    - <endpoint + status + response shape>
  state:
    - <storage / DB / session state>

negative_cases:  # bắt buộc liệt kê, không được skip
  - <case>: <expected error behavior>

acceptance_criteria:
  - <criteria có thể verify>
```

### 4. Phân loại test type

Map mỗi scenario vào: **smoke** (critical path) / **regression** (full coverage) / **negative** (error handling) / **edge** (boundary) / **performance**. Tham khảo §3 step 2 cho tần suất chạy.

## Nguyên tắc

- **KHÔNG bỏ qua negative cases.** Mỗi scenario phải có ít nhất 1 negative case.
- **KHÔNG mặc định mọi requirement đều automate được.** Spec §1.3 quy định ROI và determinism là điều kiện bắt buộc.
- **Nếu requirement mơ hồ → đề xuất phỏng vấn PO/BA**, không đoán.
- **Output là input cho skill `assertion-contract`** — đảm bảo `expected.ui/api/state` đủ chi tiết để design contract sau.

## Anti-pattern

- Liệt kê test case chung chung kiểu "test login thành công" mà không có UI/API/State expected cụ thể.
- Mark mọi thứ AUTOMATABLE mà không chạy checklist.
- Bỏ qua negative cases vì "happy path quan trọng hơn".
