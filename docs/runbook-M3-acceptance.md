# M3 Acceptance Runbook

> Procedure để verify M3 done criteria (`docs/plans/M3-test-data-env.md` §2).
> 9 sub-points: 6/9 automated, 3/9 device-dependent (cần Android emulator + Sauce Demo APK).

## Coverage map

| Sub-point §2 | Verification |
|--------------|--------------|
| 1. 0 hardcoded creds in code | `git grep` (manual, automated) |
| 2. Smoke 20x liên tục → 20/20 PASS | `npm run test:smoke:20x` (device required) |
| 3. Account pool lease/release log đúng, no leak khi fail | `tests/unit/account-pool.spec.ts` + `tests/unit/user-factory.spec.ts` |
| 4. 2-process concurrency: mutual exclusion | `tests/integration/account-pool-concurrency.spec.ts` |
| 5. D3 repay: AC_API_DEMO_001 real httpbin → PASS; force-fail schema → FAIL routing API/1 | `tests/api/api-demo.spec.ts` + `tests/integration/api-contract-real.spec.ts` (gated) |
| 6. D4 repay: StateChecker mobile:executeScript backend hoạt động | `tests/unit/state-checker-mobile.spec.ts` (unit), real device verify (manual) |
| 7. wdio.staging.ts skeleton chạy được với env placeholder | `npm run typecheck` + `node -e "require('./src/config/wdio.staging.ts')"` (manual) |
| 8. Network sim: 1 test với mobile:networkSpeed=edge | Manual (device required) |
| 9. Global hook: forced fail → afterEach release account | Manual via `tests/smoke` modify, hoặc verify qua log từ smoke run |

## ✅ Automated verification (run any time)

```bash
# Sub-points 3, 6 (unit logic)
npm run test:unit

# Sub-point 4 (cross-process concurrency) + sub-point 5 (MSW + force-fail)
npm run test:integration

# Sub-point 5 (real httpbin)
npm run test:api

# Sub-point 5 (gated, real httpbin via integration suite)
ALLOW_NETWORK_INTEGRATION=1 npm run test:integration

# Sub-point 7 (typecheck wdio.staging.ts)
npm run typecheck
```

Expected:
- Unit: 54 passing
- Integration: 8 passing (2 pending khi gate off)
- API: 1 passing
- Typecheck: clean exit

## 🔍 Sub-point 1 — grep no hardcoded creds

```bash
# Stop nếu match (M3 acceptance fail)
git grep -nE 'standard_user|secret_sauce|TEST_USERNAME|TEST_PASSWORD' \
  -- 'tests/' 'src/' ':!src/utils/accountPool/pool.config.json' \
  ':!src/config/index.ts' && echo "FAIL: hardcoded creds found" || echo "PASS: 0 hardcoded creds"
```

Allowed files (only legitimate references):
- `src/utils/accountPool/pool.config.json` — pool source-of-truth
- `src/config/index.ts` — TEST_USERNAME/TEST_PASSWORD are deprecated optional schema fields (D2 transition)

## 🟡 Device-dependent verification

### Pre-requisites
1. Android emulator started (Pixel_6_API_33 or equivalent matching `.env.local`).
2. `adb devices` shows 1 device online.
3. Sauce Demo APK at `./apps/SauceLabs-Demo-App.apk`.

```powershell
# Terminal 1 — emulator
$env:ANDROID_HOME = 'C:\Android'
$env:ANDROID_SDK_ROOT = 'C:\Android'
& "$env:ANDROID_HOME\emulator\emulator" -avd Pixel_6_API_33 -no-snapshot-load

# Terminal 2 — verify
adb devices
```

### Sub-point 2 — Smoke 20x

```bash
npm run test:smoke:20x
```

Expected:
- Stdout: per-run PASS log
- Final summary: `20/20 PASS`
- Each run leases account from pool (verify via `tmp/account-pool.state.json`).

If failure: stop, diagnose via Allure (last run's `reports/allure-results/`).

### Sub-point 6 — D4 mobile:executeScript real device

Verify Sauce Demo APK debuggable:
```bash
# Sauce Demo APK debuggable check (cần aapt từ Android build-tools)
aapt dump badging ./apps/SauceLabs-Demo-App.apk | grep -E 'application-debuggable'
```

Expected output: `application-debuggable` line present → backend usable. If absent, swap to a debuggable test APK (out of scope for M3 — log debt cho M4).

Run smoke với mobile:executeScript backend (manual switch — M3 chưa wire prod usage; backend only verified via unit test mock).

### Sub-point 8 — Network sim

```bash
# Modify smoke spec hoặc tạo nightly spec gọi:
#   await new NetworkSim(deps).setSpeed('edge');
#   <login flow>
# Compare duration vs 'full' baseline → expect chậm hơn (no assertion threshold M3).
```

M3 acceptance: chỉ proof framework có hook. Empirical baseline: full ~6s, edge ~12-18s (Sauce Demo).

### Sub-point 9 — afterEach release on failure

1. Temporarily inject `throw new Error('forced')` cuối spec body sau `runner.runContractById`.
2. Run `npm run test:smoke`.
3. Test FAIL nhưng:
   - Log shows `UserFactory.cleanup released` cho account đó.
   - `tmp/account-pool.state.json` cho account đó: `inUse: false` sau exit.
4. Revert spec.

## Acceptance log template

Sau khi chạy đủ 9 sub-points:

```
M3 Acceptance Run — <DATE>
1. Hardcoded creds:       PASS (grep clean)
2. Smoke 20x:             PASS (20/20)
3. Pool no-leak:          PASS (unit tests)
4. Cross-process:         PASS (integration)
5. AC_API_DEMO_001:       PASS (api + gated integration)
6. mobile:executeScript:  PASS (unit) — APK debuggable: <yes|no>
7. wdio.staging:          PASS (typecheck)
8. Network sim:           PASS (manual edge run, duration: <X>s vs full <Y>s)
9. afterEach release:     PASS (forced-fail run)

Verdict: M3 ✅ DONE / ⚠️ partial / ❌ block
```
