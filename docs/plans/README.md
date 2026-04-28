# Implementation Plans

Folder chứa **detailed implementation plan** cho mỗi milestone trong `ROADMAP.md`.

## Nguyên tắc bất biến

> **KHÔNG implement bất kỳ milestone nào khi chưa có plan sign-off.**

Plan-before-execute là rule cứng — viết code trước khi plan = high risk re-work, scope creep, miss done criteria.

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sắp start milestone MX                                   │
│    └─ Copy `_template.md` → `MX-<short-name>.md`           │
│    └─ Update ROADMAP.md: status MX = 📝 (Planning)         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Fill plan — trả lời TẤT CẢ "Plan checklist" trong       │
│    ROADMAP.md cho milestone đó + các section template      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Sign-off với stakeholder                                 │
│    └─ Review goals, scope, technical decisions, risks      │
│    └─ User approve plan → status MX = 🔵 (Plan ready)      │
│    └─ User reject → revise plan                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Execute                                                  │
│    └─ Status MX = 🟡 (In progress)                         │
│    └─ Update task checkboxes trong plan + ROADMAP.md       │
│    └─ Weekly: 1-2 dòng status update vào "Status updates"  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Validate done criteria                                   │
│    └─ Chạy acceptance test (định nghĩa trong plan)         │
│    └─ Pass → status MX = 🟢 (Done)                         │
│    └─ Fail → quay lại Execute, KHÔNG mark done             │
│    └─ Update Decisions log trong ROADMAP.md nếu có         │
└─────────────────────────────────────────────────────────────┘
```

## Cấu trúc plan file

Mỗi plan dùng `_template.md` làm gốc. Đặt tên: `M<num>-<kebab-case-name>.md`

Ví dụ:
- `M1-foundation.md`
- `M2-validation-framework.md`
- `M3-test-data-env.md`

## Khi nào revise plan giữa chừng

Cho phép revise plan trong khi execute, **nhưng phải:**

1. Document thay đổi + lý do trong section "Plan revisions" của plan file.
2. Update `Decisions log` trong `ROADMAP.md` nếu thay đổi technical decision.
3. Nếu thay đổi scope/done criteria → cần re-sign-off với stakeholder, KHÔNG tự ý expand.

**Anti-pattern:** "scope creep" — silently mở rộng scope khi đang code, không update plan → kết quả không match expectation, phải re-do.

## Liên hệ với spec

Mỗi plan phải:
- Reference đúng section spec (`automation_testing_requirement.md` §X)
- Map deliverables về Skills tương ứng (`.claude/skills/<name>`)
- KHÔNG vi phạm nguyên tắc bất biến trong CLAUDE.md
