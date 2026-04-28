# Runbook — PR Merge Gate (M4)

> Mục tiêu: định nghĩa rõ điều kiện merge `main` post-M4. Solo dev workflow,
> branch protection minimal + smoke E2E honor-system gate (Decision 7 v1.1).

Plan ref: `docs/plans/M4-cicd.md` Decision 7, §3, §2 sub-point 7.

---

## 1. 2-tầng gate

| Tầng | Enforce by | Block nếu fail |
|------|------------|----------------|
| **Auto CI gate** | GitHub Actions `ci.yml` + branch protection required check | YES — "Merge" button disabled |
| **Smoke E2E local** | PR template checklist + reviewer check | NO (honor-system) — reviewer enforce |

**Lý do split:** M4 không wire device farm (Q2 sign-off 2026-04-28) → smoke E2E
chạy real Android device dev-only, CI runner không có device. Solo dev = anh
vừa làm vừa review, không có 2nd reviewer → "1 review required" sẽ block forever.

---

## 2. Auto CI gate (`ci.yml`)

PR mở → workflow `CI` chạy job `verify`:
1. typecheck
2. lint (no `pause()` / `sleep()`)
3. quarantine deadline check (`scripts/check-quarantine.cjs`)
4. unit (75 specs)
5. integration (8 + 2 gated; gated skip vì `ALLOW_NETWORK_INTEGRATION=''`)
6. api contract (1 spec, real httpbin)

Wall < 5 phút. Allure artifact upload (7-day retention).

**Required check name (branch protection):** `verify`

---

## 3. Branch protection setup

### 3a. Auto qua `gh` CLI (preferred)

```bash
./scripts/setup-branch-protection.sh
```

Verify:
```bash
gh api repos/santete/appium-automation-testing/branches/main/protection | jq '.'
```

Idempotent — chạy lại OK.

### 3b. UI alternative <a id="branch-protection-ui"></a>

Khi `gh` CLI không cài / Enterprise org block API → setup qua GitHub UI:

1. Repo → **Settings** → **Branches** → **Add branch protection rule**.
2. Branch name pattern: `main`
3. Tick các option:
   - [x] **Require status checks to pass before merging**
     - [x] Require branches to be up to date before merging
     - Status check: `verify` (search + add — workflow `CI` job `verify`)
   - [ ] Require a pull request before merging — **OFF** (solo dev)
   - [ ] Require conversation resolution before merging — OFF
   - [ ] Require signed commits — OFF
   - [ ] Require linear history — OFF
   - [ ] Do not allow bypassing the above settings — OFF (admin có thể override emergency fix)
   - [x] **Restrict who can push to matching branches** → empty list = block force-push gián tiếp
     - [x] Allow force pushes — **OFF** (block force-push)
     - [x] Allow deletions — **OFF** (block branch deletion)
4. **Create** / **Save changes**.

### 3c. Verify gate hoạt động

1. Mở PR có forced-fail (ex: `npm run typecheck` fail intentionally) → status check RED → "Merge" button disabled.
2. Mở PR clean → CI green → "Merge" button enabled.
3. `git push --force origin main` từ local → reject với message "protected branch".

---

## 4. Smoke E2E local verify gate (honor-system)

PR template checklist (`.github/PULL_REQUEST_TEMPLATE.md`) yêu cầu:

```
[ ] npm run test:smoke PASS local trên dev Android device/emulator
[ ] Allure HTML attach hoặc paste link reports/allure-report/index.html
[ ] Nếu skip vì PR thuần docs/CI/non-runtime → tick [ ] N/A — docs-only PR
```

### Khi nào N/A acceptable?

- Pure docs change (`docs/`, `README.md`).
- Pure CI/workflow change (`.github/workflows/`) — runtime code không touch.
- Pure config change không ảnh hưởng smoke flow (vd. ESLint rule, Prettier).

### Khi nào MUST run smoke?

- Code trong `src/pages/`, `src/tasks/`, `src/utils/`, `src/factories/`.
- Mocha hook (`tests/_hooks/`).
- Spec dependency chain change (account pool, factory, env loader).

### Run command

```bash
npm run test:smoke
```

Pass criteria: 1+ smoke spec PASS, no flake. Allure HTML check `reports/allure-report/index.html`.

### Evidence link options

- Screenshot Allure HTML home (PASS verdict + duration).
- Gist của log output (`npm run test:smoke 2>&1 | tee smoke.log` → upload).
- Path tương đối `reports/allure-report/index.html` (reviewer pull branch check local).

### Reviewer responsibility

- Reject PR nếu checkbox tick mà evidence không attach.
- Reject PR nếu evidence cũ (≥ 1 week stale).
- Reject PR nếu `[ ] N/A` tick mà file change rõ ràng cần smoke.

---

## 5. Quarantine list discipline

Per Decision 10 + Decision 12:

| Action | Rule |
|--------|------|
| Add new entry | deadline ≤ added + 14 ngày + owner present |
| Extend entry | grace tối đa 7 ngày (≤ added + 21 ngày total) |
| Past-deadline | CI fail (`scripts/check-quarantine.cjs` exit 1) |
| Schema invalid | CI fail (exit 1) — invalid YAML / missing field |

Schema validate qua `scripts/check-quarantine.cjs` chạy CI step `Quarantine deadline check`.

---

## 6. Emergency override

Phuc admin có thể bypass branch protection cho emergency fix:

1. Repo → Settings → Branches → edit rule `main` → tạm tick "Do not allow bypassing the above settings" OFF (đã default OFF — admin pass through).
2. Force-merge qua "Merge without waiting for requirements" admin option.
3. **MUST follow up** với:
   - Plan revision log entry trong `docs/plans/MX-*.md` §11 status updates.
   - ROADMAP Decisions log entry nếu là systemic change.
   - Debt log entry nếu accept shortcut.

> Lý do giữ admin override: solo dev hotfix tránh deadlock khi CI flaky / tooling issue.

---

## 7. Future gates (defer M5+)

- Slack notification khi CI fail → channel triage (deferred Decision 9 v1.1).
- Allure host share-able URL → reviewer click direct (deferred Decision 8 v1.1).
- Required review từ 2nd team-mate (khi team grow) — Decision 7 revisit.
- Smoke E2E auto trong CI qua device farm (Decision 3 revisit M5+).
