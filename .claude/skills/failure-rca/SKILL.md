---
name: failure-rca
description: Root Cause Analysis cho test failure — classify (BUG/SCRIPT/FLAKY/ENV/DATA), route feedback về đúng workflow step, tạo RCA document và update knowledge base. Dùng khi test fail cần debug. Map vào Step 7 + §6 Feedback Loop Routing.
---

# Failure RCA & Feedback Routing

Map vào **Step 7 (Analyze & Debug)** + **§6 Feedback Loop Routing** spec `automation_testing_requirement.md`.

> Spec §6 insight: "Khi test fail, hệ thống phải **tự route** feedback về đúng step để fix, không phải lúc nào cũng 'quay về đầu'."

## Khi invoke skill này

- Test failure cần debug + classify.
- User nói "test này fail tại sao / RCA / debug failure".
- Auto-invoke khi `test-validate` ra verdict ≠ GENUINE_PASS.

## Quy trình bắt buộc

### 1. Reproduction check
- Chạy lại 10 lần cùng env, cùng input → ghi pass rate.
- Reproducible (pass rate = 0%) → bug hoặc script issue.
- Intermittent (pass rate ∈ (0%, 100%)) → FLAKY.
- Pass khi rerun (pass rate = 100%) → có thể env transient → vẫn cần điều tra.

### 2. Áp Failure Classification Tree (spec §6.1)

```
[Test Fail]
  │
  ├── Reproducible?
  │     ├── No → FLAKY → route Step 5 (execution stability)
  │     └── Yes
  │           ├── App behavior wrong? → BUG → route Step 1/2 + dev team
  │           ├── Test logic wrong?   → SCRIPT_ISSUE → route Step 4
  │           └── Env-related?        → ENV/DATA_ISSUE → route Step 3
```

### 3. Routing decision table (spec §6.2)

| Symptom | Reproducible | Layer | Verdict | Route to |
|---------|--------------|-------|---------|----------|
| API 500 | ✅ | API | App Bug | Step 1 (req review) hoặc dev team |
| UI element missing | ✅ | UI | Bug HOẶC locator sai | Investigate → Step 4 hoặc dev |
| Fail 3/10 runs | ❌ | UI/API | Flaky | Step 5 (`test-implement` wait strategy) |
| Pass local, fail CI | ✅ trong CI | Any | Env | Step 3 (`test-data-setup`) |
| Test data conflict | ✅ | Data | Isolation broken | Step 3 (`test-data-setup`) |
| Schema mismatch | ✅ | API | Contract changed | Step 1 + `assertion-contract` update |
| Perf regression | ✅ | Perf | Perf bug | Step 2 (review SLA) + dev |
| PASS but should FAIL | ✅ | Assertion | Wrong contract | Step 2 (`assertion-contract` fix) |

### 4. Output bắt buộc — RCA YAML

```yaml
test_id: TC_<DOMAIN>_<NNN>
run_id: <uuid>
result: FAIL | FLAKY (<pass_rate>/<total_runs>)

timeline:
  - <ISO8601>: <action>
  - <ISO8601>: <observation>
  - <ISO8601>: <fail point>

category: BUG | SCRIPT_ISSUE | FLAKY | ENV_ISSUE | DATA_ISSUE
layer: UI | API | STATE | PERF | INFRA

root_cause:
  description: <ngắn gọn, 1-2 câu>
  evidence:
    - <file path>: <relevant detail>
  technical: <giải thích kỹ thuật>

fix:
  change: <thay đổi cụ thể>
  file: <path>:<line>
  alternative_considered: <option khác và lý do bỏ>

verification:
  before_fix: <pass_rate>
  after_fix: <pass_rate>  # phải ≥20 run cùng env
  regression_check: <list test khác đã verify không bị ảnh hưởng>

feedback_route:
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  skill: <skill name nào sẽ apply fix>
  assignee: dev_team | qa_team | devops_team
  priority: P0 | P1 | P2 | P3
```

### 5. Loop closure checklist (spec §6.4)

Trước khi đóng RCA, verify ALL:
- [ ] Issue identified với evidence
- [ ] Root cause documented
- [ ] Fix implemented
- [ ] Fix verified isolated (≥20 run cùng pass)
- [ ] Regression check passed (test khác không bị ảnh hưởng)
- [ ] RCA archived vào `docs/rca/<test_id>_<date>.yaml`

### 6. Update Knowledge Base (spec §6.5)

Sau mỗi RCA, update `docs/flaky_kb.md` (hoặc `kb/<category>.yaml`):

```yaml
patterns:
  - pattern: "<symptom string ngắn>"
    frequency: <count> occurrences
    common_cause: <root cause typical>
    common_fix: <fix typical>
    last_seen: <date>
```

KB là input cho future debug — junior engineer tra KB trước khi RCA mới.

## Human-in-the-loop rule (spec §6.6)

- Auto-classify nếu confidence > 0.9 (rõ ràng theo decision table).
- Confidence ≤ 0.9 → flag cho human triage, không tự apply fix.
- Self-healing locator: SUGGEST PR, **KHÔNG auto-merge** (spec §7.8 + §9.4).

## Anti-pattern (spec §9.3, §9.4)

- ❌ "Retry x3 rồi pass thì kệ" — che giấu flaky thật.
- ❌ Skip test fail thay vì RCA → mất coverage.
- ❌ Đóng RCA mà không verify after_fix ≥20 run.
- ❌ Auto-apply locator fix vào main branch.
- ❌ RCA không kèm evidence file paths → không reproducible.
- ❌ Không update KB → team lặp lại lỗi cũ.
