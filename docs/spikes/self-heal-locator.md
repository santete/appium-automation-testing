# Spike — Self-healing locator suggester

> **Status:** Proposal v1.0 (M5 Task 4) · 2026-04-28
> Plan ref: `docs/plans/M5-observability.md` Decision 4 + spec §7.8 + §9.4
> Skill: `test-implement`

## Vấn đề

Locator drift là một trong những flaky cause hàng đầu (§9.2). Khi dev rename `~test-Cart` → `~test-CartV2`, mọi UI test liên quan đều fail "no such element". Manual fix:

1. Reproduce fail.
2. Inspect device để tìm selector mới.
3. Update Page Object.
4. Re-run + verify.

Quy trình ~30 phút cho mỗi locator. Với 50+ Page Objects, drift xảy ra mỗi sprint → MTTR tăng tuyến tính.

## Goal (M5 acceptance test §6 sub-point 4)

> Simulate locator break (rename `~test-Cart` thành `~test-CartV2` trong app) → runner detect mismatch → AI suggest top-3 alternative locator → mở PR. **KHÔNG auto-merge.**

## Approach (proposal)

```
[Test fail: NoSuchElement]
        │
        ↓
[Capture context]
  - failing selector string
  - Page Object file path + line number
  - device page source XML (truncated <2k tokens)
  - last visible screenshot path
        │
        ↓
[LLM adapter (Task 0)]
  prompt: "Given this Appium page source + failing selector,
           suggest top-3 alternative selectors ranked by confidence.
           Output JSON: { suggestions: [{newSelector, selectorType, confidence, reasoning}, ...] }"
        │
        ↓
[Parse + Zod validate suggestions]
        │
        ↓
[Open PR with edit to Page Object file]
  - title: [self-heal] {PageObject} {field} locator drift
  - body: failing selector | top-3 suggestions với confidence
  - branch: self-heal/{testId-hash}
        │
        ↓
[Branch protection: require human review + 1 approval]
```

## Spike pass criteria

Spike sẽ mark **PASS** nếu:

1. **Suggester accuracy:** trên 5 synthetic drift case (rename, attribute change, repositioning, class-name shift, accessibility-id drop), top-1 suggestion match ground truth ≥ 3/5 (60% — đủ để PR review thấy giá trị).
2. **Cost cap:** 1 suggestion call < $0.05 USD (with claude-sonnet-4-6 + 2k tokens prompt). Budget tracker (M5 Task 0) catch overrun.
3. **PR generation:** `gh pr create` mở PR thành công trên test repo, branch protection block auto-merge (verify settings).
4. **Schema enforcement:** invalid LLM output (missing field) → suggester throw `LlmInvalidOutputError` → CI workflow report fail, không silently merge garbage.
5. **No-op safety:** nếu suggestion có cùng selector với original → suggester return empty list (no-op), không mở PR rỗng.

## Out of scope (defer M6)

- Vector search trên KB historical drift patterns (Decision 9 M5 — not selected).
- Auto-merge khi confidence > 0.95 (spec §7.8 forbid; human in loop mandatory).
- Multi-page suggestion (spike chỉ làm 1 selector / 1 PR).
- iOS-specific selector strategies (M4 BrowserStack defer).

## Risk + mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM hallucinate selector không tồn tại trong page source | M | H | Prompt require evidence từ XML; Zod schema force `newSelector` non-empty + cross-check với page source token list. |
| Page source quá lớn → token cost explode | M | M | Truncate XML to relevant subtree (parent + 2 levels) trước khi gửi LLM; cap 4k tokens. |
| PR spam khi 10+ tests cùng fail vì drift đồng loạt | M | L | Group suggestions theo Page Object file → 1 PR per file, không 1 PR per test. |
| Branch protection chưa enable trên main | L | H | Pre-flight check `gh api /repos/.../branches/main/protection` trước khi mở PR; abort nếu missing. |

## Implementation files

- `src/utils/selfHeal/suggester.ts` — core logic, takes `SelfHealInput` + `LlmAdapter` + `LlmBudgetTracker`, returns `SelfHealResult` hoặc throw.
- `tests/unit/self-heal.spec.ts` — mocked adapter, verify prompt + parse + ranking.
- `.github/workflows/self-heal.yml` — triggered on UI test failure (acceptance Task 12 wire).
- `scripts/self-heal-pr.cjs` — runner glue calling suggester + `gh pr create`.

## Decision log

| Date | Decision | Why |
|------|----------|-----|
| 2026-04-28 | LLM-based, không rule-based DOM diff | Page source XML phức tạp, regex-only sẽ miss attribute permutation. LLM tổng hợp context tốt hơn. Trade-off: cost — mitigated bằng token cap + budget gate. |
| 2026-04-28 | Top-3 suggestions thay vì top-1 | Reviewer cần tùy chọn — confidence top-1 chưa chắc đúng (60% accuracy spike target). 3 alternatives giữ option open. |
| 2026-04-28 | PR per Page Object file, không per test | Tránh PR spam khi drift hàng loạt; reviewer review 1 file nhanh hơn 10 PR riêng. |
