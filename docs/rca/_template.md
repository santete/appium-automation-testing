# RCA — `<TEST_ID>` — `<YYYY-MM-DD>`

> Template — copy file này thành `docs/rca/<TEST_ID>_<YYYY-MM-DD>.md`
> sau mỗi failure routed qua skill `failure-rca` (spec §6.4 loop closure).
>
> **Auto-link:** sau khi viết xong, update field `Links → RCA` trong KB
> entry tương ứng (`docs/flaky_kb.md`). M5 acceptance §2 sub-point 3 verify
> rằng KB grow đúng + link RCA back-pointer đúng.

## Metadata

| Field        | Value                                                    |
|--------------|----------------------------------------------------------|
| Test ID      | `<TC_DOMAIN_NNN>`                                        |
| First fail   | `<ISO8601 timestamp>`                                    |
| Run ID       | `<uuid hoặc gh actions run id>`                          |
| Author       | `<engineer name>`                                        |
| Category     | BUG \| SCRIPT_ISSUE \| FLAKY \| ENV_ISSUE \| DATA_ISSUE  |
| Layer        | UI \| API \| STATE \| PERF \| INFRA                      |
| Severity     | P0 \| P1 \| P2 \| P3                                     |
| Reproducible | true \| false (`<pass_rate>/<total_runs>`)               |
| KB entry     | `KB-<YYYYMMDD>-<NNN>` (auto-appended bởi `kb/appender.ts`) |
| Classifier   | `<matchedRule>` @ confidence `<0.00-1.00>`               |

## Timeline

> Chronology actions/observations dẫn đến failure point.

- `<ISO8601>` — <step taken / signal observed>
- `<ISO8601>` — <next step>
- `<ISO8601>` — <fail point + first error log line>

## Reproduction

1. Steps để reproduce locally:
   - <step 1>
   - <step 2>
2. Pass rate trên N rerun cùng env: `<x/N>` → <reproducible | flaky | not-reproducible>
3. Env diff vs CI (nếu reproducible CI-only):
   - <env var hoặc service diff>

## Root cause

<1-2 câu mô tả ngắn — dùng làm KB Pattern>

### Technical detail

<giải thích kỹ thuật: code path, race condition, schema mismatch, locator drift, account pool exhaustion, ...>

### Evidence

- `<file path>:<line>` — <relevant detail>
- `<artifact path>` (Allure attachment / log line)

## Fix

| Field                    | Value                                          |
|--------------------------|------------------------------------------------|
| Change summary           | <ngắn gọn 1 dòng>                              |
| File                     | `<path>:<line>`                                |
| PR link                  | `<gh PR URL>`                                  |
| Alternative considered   | <option khác + lý do bỏ>                       |
| Risk / blast radius      | <module nào có thể bị ảnh hưởng>               |

## Verification

| Field                    | Value                                          |
|--------------------------|------------------------------------------------|
| Before fix pass rate     | `<x/N>`                                        |
| After fix pass rate      | `<x/M>` (M ≥ 20 per spec §6.4)                 |
| Regression check         | <list test ID khác đã verify không bị ảnh hưởng> |

## Feedback routing

| Field      | Value                                                |
|------------|------------------------------------------------------|
| Route to   | step 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8            |
| Skill      | `<skill name nào sẽ apply fix>`                      |
| Assignee   | dev_team \| qa_team \| devops_team                   |
| Priority   | P0 \| P1 \| P2 \| P3                                 |

## Loop closure checklist (spec §6.4)

- [ ] Issue identified với evidence
- [ ] Root cause documented (technical detail)
- [ ] Fix implemented + PR link present
- [ ] Fix verified isolated (≥ 20 run cùng pass — Verification table)
- [ ] Regression check passed
- [ ] RCA archived (file này committed vào `docs/rca/`)
- [ ] KB entry `Links → RCA` updated trỏ về file này
- [ ] KB entry `Remediation` updated bằng change summary

## Notes (optional)

<nội dung thêm: postmortem-style lessons learned, follow-up debt log entry, link đến similar RCA cũ trong KB>
