# Failure Knowledge Base (KB)

> M5 Task 7 deliverable. Plan ref: `docs/plans/M5-observability.md` Decision 3
> (markdown storage cho M5; promote SQLite khi > 50 entry).
>
> **Auto-appended bởi `src/utils/kb/appender.ts`** mỗi khi classifier engine
> match 1 failure với confidence ≥ 0.85. Mỗi entry ghi pattern, evidence,
> remediation, và link back về RCA archive khi có.
>
> **Đọc:** grep theo `category:`, `testId:`, hoặc `pattern:` để tìm precedent
> trước khi triage failure mới.

## Schema (per entry)

Mỗi entry là 1 H3 heading + bảng metadata + sections cố định:

```
### <ENTRY-ID> — <short title>

| Field        | Value                                       |
|--------------|---------------------------------------------|
| Created      | YYYY-MM-DD HH:MM:SS UTC                     |
| Test ID      | <testId>                                    |
| Category     | BUG \| SCRIPT_ISSUE \| FLAKY \| ENV_ISSUE \| DATA_ISSUE \| UNKNOWN |
| Layer        | UI \| API \| STATE \| PERF                  |
| Confidence   | 0.00 - 1.00                                 |
| Matched rule | <rule-id từ classifier/rules.ts>            |
| Route to     | step 1-8                                    |
| Assign to    | dev_team \| qa_team \| devops_team          |
| Priority     | P0 \| P1 \| P2 \| P3                        |
| Reproducible | true \| false                               |
| Repro rate   | 0.00 - 1.00                                 |

**Pattern:**
<rootCause.description>

**Evidence:**
- <evidence[0]>
- <evidence[1]>
- ...

**Remediation:**
_(filled khi fix landed; auto-link RCA archive khi có)_

**Links:**
- RCA: _(filled khi RCA viết)_
- PR fix: _(filled khi merged)_
```

## Entry ID convention

`KB-YYYYMMDD-NNN` — date prefix + 3-digit sequence trong ngày. Appender đọc
file hiện tại, tìm số seq cao nhất của ngày, +1.

## Promotion to SQLite

Khi `wc -l docs/flaky_kb.md > 1500` (xấp xỉ ~50 entry × 30 dòng/entry) →
trigger M6 task migrate sang SQLite + FTS5 search.

## Manual edit

Các section `Remediation:` + `Links:` là human-edited sau khi RCA viết. Auto-
appender chỉ tạo skeleton + 4 field cố định (Pattern, Evidence, Remediation
placeholder, Links placeholder) — never overwrite manual content.

## Idempotency contract

Appender so dedup theo `(testId, matchedRule, rootCause.description)` trong
window 24h gần nhất. Match → skip append, log info. Mục đích: cùng 1 flaky
test fire 30 lần trong day không poison KB.

---

<!-- KB_ENTRIES_BELOW — appender insert entry mới ngay sau marker này -->
