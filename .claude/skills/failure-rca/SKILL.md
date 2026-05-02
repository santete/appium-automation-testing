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

## M5 automation pipeline (auto-fed inputs)

Trước khi viết RCA bằng tay, leverage automation đã có (M5 Task 1+2+7):

1. **Classifier output** — `src/utils/classifier/engine.ts` đã chạy → có sẵn `FailureClassification` với `matchedRule`, `confidence`, `routeTo`, `assignTo`. Đọc field này thay vì re-derive routing.
2. **LLM escalator** (`src/utils/classifier/llmEscalator.ts`) — confidence < 0.85 hoặc category UNKNOWN → adapter tự upgrade qua LLM (config-driven `.env`). Output đã merge vào classification.
3. **KB appender** (`src/utils/kb/appender.ts`) — entry `KB-YYYYMMDD-NNN` đã tự ghi vào `docs/flaky_kb.md` với confidence ≥ 0.85. RCA file MỚI cần update `Links → RCA` trong entry đó (KB-side ID phải link 2 chiều).
4. **Allure attachment** — afterTest hook đã attach screenshot + page source vào Allure run; reference URL Allure trong RCA Evidence section.

Workflow mới (M5+):

```
Failure → classifier → KB skeleton (auto) → human triage → RCA file (template _template.md)
                                                           → cross-link RCA ↔ KB entry
                                                           → fix PR → verification ≥ 20 run → close
```

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

### 4. Output bắt buộc — RCA file từ template

**M5+ format:** copy `docs/rca/_template.md` thành `docs/rca/<TEST_ID>_<YYYY-MM-DD>.md`. Template (markdown table-style) thay cho YAML cũ — readable hơn trong GH UI + dễ link Allure attachment.

Template sections (tất cả mandatory):

- **Metadata** — Test ID, classifier matchedRule + confidence, KB entry ID, severity, reproducibility.
- **Timeline** — chronology actions/observations/fail point.
- **Reproduction** — local steps + pass rate + env diff CI vs local.
- **Root cause** — description (1-2 câu, dùng làm KB Pattern) + technical detail + evidence file paths.
- **Fix** — change summary, file:line, PR link, alternative considered, risk.
- **Verification** — before/after pass rate (M ≥ 20 per spec §6.4) + regression check.
- **Feedback routing** — step, skill, assignee, priority.
- **Loop closure checklist** — 8 checkbox tick trước khi đóng.

### 5. Loop closure checklist (spec §6.4)

Sao chép vào RCA file (template đã có sẵn — chỉ tick):

- [ ] Issue identified với evidence
- [ ] Root cause documented (technical detail)
- [ ] Fix implemented + PR link present
- [ ] Fix verified isolated (≥ 20 run cùng pass)
- [ ] Regression check passed
- [ ] RCA file committed vào `docs/rca/`
- [ ] KB entry `Links → RCA` cập nhật trỏ về RCA file
- [ ] KB entry `Remediation` viết tóm tắt change

### 6. Update Knowledge Base (spec §6.5)

KB entry skeleton đã được auto-append bởi `src/utils/kb/appender.ts` (M5 Task 7) — engineer chỉ cần update 2 manual section:

- **Remediation:** điền change summary từ Fix table.
- **Links → RCA:** trỏ về `docs/rca/<TEST_ID>_<YYYY-MM-DD>.md`.
- **Links → PR fix:** trỏ về PR khi merged.

KB là input cho future debug — junior engineer grep `Pattern:` trong `docs/flaky_kb.md` trước khi mở RCA mới. Dedup window 24h ngăn poison khi cùng failure fire nhiều lần (xem `kb/appender.ts`).

## Human-in-the-loop rule (spec §6.6)

- Auto-classify nếu rule-engine confidence ≥ 0.85 (M5 Task 1 hard cutoff). Engineer vẫn cần xác nhận route khi viết RCA — auto chỉ là first-pass.
- Confidence < 0.85 → LLM escalator (Task 2) thử upgrade; vẫn < 0.85 → flag cho human triage, không tự apply fix.
- Self-healing locator: SUGGEST PR, **KHÔNG auto-merge** (spec §7.8 + §9.4).
- Flaky auto-quarantine (Task 3): combined threshold `<90%/30 AND ≥1/5` mới trigger; engineer có thể `quarantine: false` flag để force keep nếu xác định bug thật.

## Anti-pattern (spec §9.3, §9.4)

- ❌ "Retry x3 rồi pass thì kệ" — che giấu flaky thật.
- ❌ Skip test fail thay vì RCA → mất coverage.
- ❌ Đóng RCA mà không verify after_fix ≥20 run.
- ❌ Auto-apply locator fix vào main branch.
- ❌ RCA không kèm evidence file paths → không reproducible.
- ❌ Không update KB → team lặp lại lỗi cũ.
