# M<NUM> — <Milestone Name>

> Implementation plan cho milestone M<NUM>. Workflow đầy đủ xem `docs/plans/README.md`.

## Metadata

| Field | Value |
|-------|-------|
| Milestone ID | M<NUM> |
| Spec section | `automation_testing_requirement.md` §11 Phase <N> |
| Status | 📝 Planning / 🔵 Plan ready / 🟡 In progress / 🟢 Done |
| Plan author | <name> |
| Plan version | v0.1 (draft) → v1.0 (signed-off) |
| Created | <YYYY-MM-DD> |
| Sign-off date | <YYYY-MM-DD> hoặc "pending" |
| Sign-off by | <name> |
| Target start | <YYYY-MM-DD> |
| Target end | <YYYY-MM-DD> |
| Actual start | <YYYY-MM-DD> hoặc "—" |
| Actual end | <YYYY-MM-DD> hoặc "—" |

---

## 1. Goal

<Mục tiêu rõ ràng, 1-2 câu. Copy từ ROADMAP.md, có thể detail thêm.>

## 2. Done criteria (acceptance test)

<Sao chép từ ROADMAP.md. Đây là điều kiện duy nhất để mark milestone DONE.>

**Acceptance test cụ thể:**
1. <Bước verify 1, có thể chạy được>
2. <Bước verify 2>
3. ...

## 3. Scope

### In scope
- <Item 1 — cụ thể, có thể implement>
- <Item 2>

### Out of scope (explicit)
- <Item bị loại — ghi rõ để tránh scope creep>
- <Lý do tại sao loại>

## 4. Technical decisions

Trả lời TẤT CẢ "Plan checklist" trong ROADMAP.md cho milestone này:

### Decision 1: <tên decision>
- **Question:** <câu hỏi từ ROADMAP.md>
- **Options considered:**
  - Option A: <pros / cons>
  - Option B: <pros / cons>
- **Decision:** <Option chọn>
- **Rationale:** <lý do, dựa trên constraint nào>

### Decision 2: ...

> Mỗi decision sau khi sign-off phải copy vào `Decisions log` trong `ROADMAP.md`.

## 5. Task breakdown

| # | Task | Deliverable file | Estimate | Status | Skill |
|---|------|------------------|----------|--------|-------|
| 1 | <task name> | `<path>` | <h> | ⬜/🟡/🟢 | `<skill-name>` |
| 2 | ... | | | | |

**Total estimate:** <hours/days>

## 6. Dependencies

### Upstream (must finish first)
- [ ] M<X> done — vì <lý do>
- [ ] <Decision/artifact bên ngoài>

### Downstream (block these)
- M<Y> không thể start cho đến khi milestone này done.

### External dependencies
- <Account/credential cần xin>
- <Tool/license cần mua>
- <Người cần phối hợp>

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| <risk 1> | H/M/L | H/M/L | <action> |
| <risk 2> | | | |

## 8. Test plan (verify deliverables)

- [ ] Unit test cho <component> đạt coverage > <X>%
- [ ] Integration test: <flow>
- [ ] Manual smoke: <scenario>
- [ ] Acceptance test trong section 2 pass

## 9. Rollback plan

Nếu phải hủy milestone giữa chừng:
- <Bước rollback 1>
- <Files/configs cần revert>

## 10. Sign-off checklist

Trước khi chuyển status → 🔵 Plan ready:

- [ ] Goal + Done criteria khớp ROADMAP.md
- [ ] Scope rõ ràng (in/out)
- [ ] Tất cả "Plan checklist" trong ROADMAP.md đã trả lời
- [ ] Task breakdown có owner + estimate
- [ ] Dependencies xác định
- [ ] Risks đã thảo luận
- [ ] Stakeholder approve

## 11. Status updates (weekly)

| Date | Update | Blockers |
|------|--------|----------|
| <YYYY-MM-DD> | <1-2 dòng> | <blocker hoặc "none"> |

## 12. Plan revisions

Ghi lại mọi thay đổi plan sau khi đã sign-off:

| Date | Change | Reason | Re-sign-off needed? |
|------|--------|--------|---------------------|
| <YYYY-MM-DD> | <thay đổi> | <lý do> | Yes/No |

## 13. Closure

Điền khi mark milestone DONE:

- [ ] Tất cả deliverables ở section 5 status = 🟢
- [ ] Acceptance test ở section 2 pass (kèm evidence)
- [ ] Decisions log trong ROADMAP.md đã update
- [ ] ROADMAP.md status = 🟢
- [ ] Lessons learned cho milestone tiếp theo:
  - <lesson 1>
  - <lesson 2>
