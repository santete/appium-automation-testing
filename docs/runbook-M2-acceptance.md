# M2 Acceptance Runbook

> Procedure để verify M2 done criteria (plan §2). 5/8 sub-points đã verify
> qua unit + integration tests. 3/8 sub-points (6, 7, 8) cần real device.

## ✅ Verified by automated tests

Run từ repo root:
```bash
npm run test:unit         # 31 tests — sub-points 1, 3, 4, 5
npm run test:integration  # 6 tests — sub-points 1 (API), 2 (API), 4 (warn), 5 (critical stop)
```

Coverage map:
| Sub-point §2 | Test |
|--------------|------|
| 1. UI fail → routeTo=4 | `unit/assertion-runner.spec.ts` "FailureMetadata: UI fail" |
| 2. API schema mismatch → routeTo=1 | `integration/contract-execution.spec.ts` "MSW returns wrong schema" |
| 3. State fail → routeTo=4 | `unit/checkers.spec.ts` "StateChecker not_null fail" + runner unit covers state→layer |
| 4. Medium fail → PASS_WITH_WARNINGS | `unit/assertion-runner.spec.ts` "medium fail only" |
| 5. Critical → stop early | `unit/assertion-runner.spec.ts` "critical fail" + `integration` "MSW returns 500" |

## 🟡 Manual device-dependent verification

Sub-points 6, 7, 8 — yêu cầu Android emulator + Sauce Demo APK. Theo runbook
M1 (`docs/runbook.md`):

### Sub-point 6: TC_LOGIN_001 contract pass

```powershell
# Terminal 1 — start emulator (Pixel_API_31 hoặc tương đương)
emulator -avd Pixel_API_31 -no-snapshot-load

# Terminal 2 — verify đã connect
adb devices

# Terminal 3 — run smoke
npm run test:smoke
```

**Expected:**
- TC_LOGIN_001 → AC_LOGIN_001 contract → verdict `PASS`
- Allure attachment `verdict.json` shows 3 UI checks + 2 negative checks
- `npm run allure:serve` → step list trong UI report hiển thị
  `[UI/CRITICAL] ui.cart_visible (element_visible, ...ms)` etc.

### Sub-point 7: 5/5 stability

```powershell
for ($i=1; $i -le 5; $i++) { npm run test:smoke }
```

**Expected:** 5/5 PASS, no flakiness. Record run durations + verdict status
trong plan §13 lessons learned.

### Sub-point 8: Allure per-layer verdict visible

Sau khi chạy smoke ≥1 lần:
```powershell
npm run allure:serve
```

**Verify trên Allure UI:**
- Test labels hiển thị: `contract_id`, `test_scenario`, `verdict`, layer
  argument counts (ví dụ `UI_layer = 3/3 passed`)
- Steps tab show 1 step per AssertionResult với ✓/✗ prefix + duration
- Attachments: `verdict.json`, optionally `failure-metadata.json` nếu fail
- Final summary step: `Verdict: ✅ PASS (5 checks, ...ISO timestamp)`

## Acceptance checklist

- [ ] `npm run test:unit` → 31/31 pass
- [ ] `npm run test:integration` → 6/6 pass
- [ ] Manual smoke run #1 → PASS, screenshot Allure
- [ ] Manual smoke run #2-5 → all PASS (record durations)
- [ ] Allure attachments verified (verdict.json present, per-layer steps visible)
