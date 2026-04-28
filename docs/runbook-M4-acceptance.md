# M4 Acceptance Runbook

> Procedure verify M4 done criteria (`docs/plans/M4-cicd.md` §2 v1.1, 2026-04-28).
> 7 sub-points: 4/7 automated qua `npm` + GH Actions, 2/7 manual GH UI verify, 1/7 device-dependent.

Plan ref: `docs/plans/M4-cicd.md` Decision 7-12.

## Coverage map

| Sub-point §2 v1.1 | Verification | Owner action |
|-------------------|--------------|--------------|
| 1. Repo + branch protection minimal | `gh api ... /branches/main/protection` | One-time setup script |
| 2. CI gate on PR (typecheck + lint + quarantine + unit + integration + api) | Open test PR → check Actions tab | Manual GH UI verify |
| 3. CI fail block merge | Force-fail PR → "Merge" disabled | Manual GH UI verify |
| 4. Nightly regression cron + manual dispatch | `workflow_dispatch` regression.yml | Manual GH UI verify |
| 5. Quarantine list + deadline check | `npm run check:quarantine` 3 paths | Automated |
| 6. D4 real-device repay | `RUN_REAL_DEVICE=1 npm run test:integration` | Device required |
| 7. Smoke local verify gate | PR template + runbook present | Manual review check |

---

## ✅ Automated verification (run any time)

```bash
# Sub-points 5 + most of CI gate parity (run-locally what CI runs)
npm run typecheck
npm run lint
npm run check:quarantine
npm run test:unit
npm run test:integration
npm run test:api
```

Expected:
- typecheck: clean exit
- lint: 0 error / 0 warning
- check:quarantine: `[OK]` exit 0
- unit: 75 passing
- integration: 8 passing + 4 pending (2 gated httpbin + 2 gated D4 device)
- api: 1 passing

---

## 1️⃣ Sub-point 1 — Branch protection setup

### Setup (one-time)

```bash
# Auto path (preferred) — requires gh CLI
./scripts/setup-branch-protection.sh

# UI alternative (gh không cài) — xem docs/runbook-pr-merge-gate.md §3b
```

### Verify

```bash
gh api repos/santete/appium-automation-testing/branches/main/protection \
  | jq '{required_status_checks, required_pull_request_reviews, allow_force_pushes, allow_deletions}'
```

Expected:
```json
{
  "required_status_checks": {"strict": true, "contexts": ["verify"]},
  "required_pull_request_reviews": null,
  "allow_force_pushes": {"enabled": false},
  "allow_deletions": {"enabled": false}
}
```

---

## 2️⃣ Sub-point 2 — CI gate on PR

### Test procedure

1. Tạo branch `chore/m4-acceptance-test` từ `main`.
2. Add trivial change (vd. README typo fix).
3. `git push` + `gh pr create`.
4. Mở PR trên GH UI → tab "Checks" → workflow `CI` chạy.

### Pass criteria

- Job `verify` GREEN sau < 5 phút.
- 6 step pass (typecheck, lint, quarantine, unit, integration, api).
- "Merge" button enabled.

### Evidence

- Screenshot Actions tab showing GREEN check + duration.

---

## 3️⃣ Sub-point 3 — CI fail block merge

### Test procedure

1. Trên branch test trên, add forced-fail (vd. `tsc` error: `const x: string = 42;` trong file random).
2. `git commit && git push`.
3. PR refresh → CI auto re-run.

### Pass criteria

- Job `verify` RED.
- "Merge" button disabled với message "Required status check is failing".
- Branch protection enforce (không bypass-able trừ admin override).

### Cleanup

- Revert force-fail commit, push lại → CI green → close PR (chưa cần merge).

---

## 4️⃣ Sub-point 4 — Nightly regression

### Manual dispatch verify

```bash
gh workflow run regression.yml
gh run list --workflow regression.yml --limit 1
```

UI alternative: Actions → Regression (nightly) → "Run workflow" → main → Run.

### Pass criteria

- Workflow chạy < 10 phút.
- All step pass.
- Allure artifact `allure-results-regression-<runid>` uploaded với 30-day retention.
- Download zip → unzip → mở `index.html` → Allure home shows passing test runs.

### Evidence

- Run URL từ `gh run list`.
- Allure HTML screenshot (1 page minimum).

---

## 5️⃣ Sub-point 5 — Quarantine list + deadline check

### 3-path verify (locally)

#### Path A — empty entries (current state)

```bash
npm run check:quarantine
# Expected: [OK] Quarantine: 0 entries total — 0 active, 0 past-deadline.
# Exit 0
```

#### Path B — schema invalid (temp swap)

```bash
# Backup
cp docs/quarantine.yaml docs/quarantine.yaml.bak

# Inject invalid: missing `owner`
cat > docs/quarantine.yaml <<'EOF'
entries:
  - test_id: "Login > should pass"
    reason: "test"
    added: "2026-04-28"
    deadline: "2026-05-05"
EOF

npm run check:quarantine
# Expected: [FAIL] Quarantine schema invalid: ... owner ...
# Exit 1

# Restore
mv docs/quarantine.yaml.bak docs/quarantine.yaml
```

#### Path C — past-deadline (temp swap)

```bash
cp docs/quarantine.yaml docs/quarantine.yaml.bak

cat > docs/quarantine.yaml <<'EOF'
entries:
  - test_id: "Login > should pass"
    reason: "flaky during M4 dev"
    added: "2026-04-01"
    deadline: "2026-04-15"
    owner: "phucdn7"
EOF

npm run check:quarantine
# Expected: [FAIL] Past-deadline entries — fix test hoặc extend grace ≤ 21 ngày
# Exit 1

mv docs/quarantine.yaml.bak docs/quarantine.yaml
```

### CI integration verify

- Step `Quarantine deadline check (Task 9 ...)` xuất hiện trong cả `ci.yml` + `regression.yml`.
- Past-deadline → CI red.

---

## 6️⃣ Sub-point 6 — D4 real-device repay

### Pre-requisites

1. JDK 17 + Android SDK installed (M1 verified).
2. Android device USB-connected, USB debugging ON.
3. `adb devices` → 1 device authorized.
4. Appium 2 server cài (`npm i -g appium@^2.11.0` nếu chưa có) + uiautomator2 driver `appium driver install uiautomator2@3.7.0`.

### Build APK

```bash
npm run build:test-apk
```

Expected:
- Bootstrap Gradle wrapper lần đầu (download jar + scripts).
- `assembleDebug` build success.
- Output: `apps/state-test-debug.apk` (~3-5 MB typical).

### Run real-device spec

Terminal 1 — start Appium with relaxed security:
```bash
appium --allow-insecure adb_shell --base-path /
```

Terminal 2 — set env + run gated spec:
```bash
ANDROID_DEVICE_NAME="<your-device-id-từ-adb-devices>"
ANDROID_PLATFORM_VERSION="13"
RUN_REAL_DEVICE=1 npm run test:integration
```

### Pass criteria

- Spec `Integration (REAL DEVICE): mobile:executeScript state lookup` 2 cases:
  - `default prefs: m4_state_test_key === "ok"` PASS.
  - `lookup absent key → not_null fail (negative path)` PASS.
- Cleanup: app removed sau test.

### Evidence

- Stdout log spec PASS.
- `adb shell pm list packages | grep santete` → empty sau cleanup.

---

## 7️⃣ Sub-point 7 — Smoke local verify gate

### Verify gate present

```bash
# PR template tồn tại + có smoke checklist
test -f .github/PULL_REQUEST_TEMPLATE.md && \
  grep -q 'npm run test:smoke' .github/PULL_REQUEST_TEMPLATE.md && \
  echo "PASS: PR template smoke checkbox present"

# Runbook tồn tại
test -f docs/runbook-pr-merge-gate.md && \
  echo "PASS: merge gate runbook present"
```

### Verify gate enforced (next PR cycle)

- Lần PR kế tiếp: reviewer check checklist tick + evidence link present.
- Nếu PR runtime change mà skip smoke (no evidence) → reviewer reject.

---

## ✅ Acceptance summary

Mark M4 done khi tất cả 7 sub-points pass + evidence ghi log:
- `docs/plans/M4-cicd.md` §11 status updates: "M4 acceptance run 7/7 PASS — yyyy-mm-dd".
- `ROADMAP.md` M4 status: ⬜/🟡 → 🟢 + final status update entry.

Defer M5: 3 sub-points cũ (Slack notify, Allure GH Pages, duration baseline) — đã document trong Decision 8/9 + ROADMAP global Decisions log.
