# Framework Usage Guide — Khi nào dùng cái gì

> **Đối tượng:** Engineer mới onboard hoặc engineer đã build nhưng chưa biết
> dùng framework day-to-day như thế nào.
>
> **Khác với `runbook-operations.md` (process vận hành)** — doc này trả lời
> câu hỏi **"tôi muốn làm X, framework giúp tôi qua skill/script nào?"**
>
> **Read time:** 15-20 phút. Đọc xong làm được 1 worked example end-to-end.

---

## 0. TL;DR — mental model 1 trang

**Framework giải bài toán:** "Mỗi khi mobile team ship feature mới → làm
sao biết feature đó **thực sự work** trên app thật, không phải chỉ pass
test giả + maintenance không ngốn thời gian engineer?"

**3 trụ cột:**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Multi-layer Assertion Contract (UI + API + State)         │
│    → catch false-pass (test pass nhưng bug vẫn lọt)          │
│                                                              │
│ 2. Self-routing failure RCA (8 step workflow)                │
│    → fail không còn "rerun đi" — biết bug thật vs flaky      │
│                                                              │
│ 3. Self-heal + auto-quarantine                               │
│    → maintenance < 4h/sprint thay vì vài giờ mỗi ngày        │
└──────────────────────────────────────────────────────────────┘
```

**3 use case chính:**

| Tình huống | Skill/Script chính | Time |
|------------|--------------------|------|
| **A. Ship feature mới** (BRD → spec) | `/test-requirement` → `/assertion-contract` → `/test-implement` | 2-3h/critical flow |
| **B. CI fail sáng nay** (debug + fix) | `/failure-rca` → `docs/rca/<date>-<TC>.md` | 30 phút |
| **C. Release cycle** (smoke/regression/perf) | `npm run test:smoke` / `:regression` / `:perf` | 5min / 15min / 10min |

**Input/output pipeline (use case A) — 4 file artifact:**

```
PM/BA viết BRD                    QA snapshot              QA invoke /test-requirement
   ┌──────────────┐              ┌──────────────┐              ┌─────────────────────┐
   │ Jira/Linear  │ ──── copy ──▶│ docs/        │ ───── /tr ──▶│ tests/scenarios/    │
   │ ticket       │              │ requirements/│              │ <feature>.scenario  │
   │              │              │ BRD-*.md     │              │ .yaml               │
   └──────────────┘              └──────────────┘              └─────────────────────┘
                                                                          │
                                                          clarify_needed: │ block tới empty
                                                                          ▼
                                                              ┌─────────────────────┐
                                                              │ QA ↔ PM async       │
                                                              │ Slack / Jira comment│
                                                              └─────────────────────┘
                                                                          │
                                                              status: READY_FOR_CONTRACT
                                                                          ▼
        QA invoke /assertion-contract                          QA invoke /test-implement
   ┌─────────────────────┐                                   ┌─────────────────────┐
   │ src/contracts/      │ ─────────── /ti ────────────────▶ │ tests/<suite>/      │
   │ AC_<TC_ID>.yaml     │                                   │ <feature>.spec.ts   │
   └─────────────────────┘                                   └─────────────────────┘
```

**4 artifact = 4 thư mục cố định:**

| Artifact | Thư mục | Tạo bởi | Edit sau commit? |
|----------|---------|---------|------------------|
| BRD snapshot | `docs/requirements/BRD-<slug>-<date>.md` | PM/BA → QA copy | ❌ immutable; revision = file mới `-v2` |
| Test scenarios | `tests/scenarios/<feature>.scenario.yaml` | `/test-requirement` | ✅ update khi clarify hoặc BRD revision |
| Assertion Contract | `src/contracts/AC_<TC_ID>.yaml` | `/assertion-contract` | ✅ với PR review |
| Spec implement | `tests/<suite>/<feature>.spec.ts` | `/test-implement` | ✅ với PR review |

Template + worked example xem §3.A bên dưới.

**4 chế độ chạy (chọn 1):**

| Mode | Khi dùng | Config |
|------|----------|--------|
| **Local emulator** | Dev iterate spec mới | `wdio.local.ts` |
| **Real device USB** | Verify pre-PR | `wdio.local.ts` + `ANDROID_DEVICE_NAME=<udid>` |
| **BrowserStack Android** | Cross-device matrix | `wdio.bs.ts` |
| **BrowserStack iOS** | iOS smoke (M6 spike) | `wdio.bs.ios.ts` |

---

## 1. Setup 1 lần — chọn mode chạy

### 1.1. Local emulator (Android) — fastest iteration

**Khi dùng:** Viết spec mới, debug locally, dev không có real device.

```bash
# Boot emulator
emulator -avd Pixel_6_API_33 -no-snapshot-load -no-boot-anim &
adb wait-for-device

# Verify ready
adb shell getprop sys.boot_completed   # → "1" khi sẵn sàng

# Check device
adb devices
# emulator-5554   device
```

**`.env.local` config:**

```env
ENV_PROFILE=local
ANDROID_DEVICE_NAME=emulator-5554
ANDROID_PLATFORM_VERSION=13
APP_PATH=./apps/SauceLabs-Demo-App.apk
```

**Run:**

```bash
npm run test:smoke
```

⚠️ **Caveat perf test:** emulator chậm hơn real device 4-5x → set
`PERF_LOGIN_SLA_MS=5000` (xem `docs/rca/2026-05-01-TC_PERF_LOGIN_001.md`).

### 1.2. Real device USB (Android) — pre-PR verification

**Khi dùng:** Verify flow thực tế trước khi mở PR, test perf với
threshold đúng (spec §7.5 calibrate cho real device).

```bash
# Cắm device qua USB, enable USB debugging
adb devices
# R3CR70XXXXX   device   ← đây là udid

# Cài app
adb install -r ./apps/SauceLabs-Demo-App.apk
```

**`.env.local`:**

```env
ENV_PROFILE=local
ANDROID_DEVICE_NAME=R3CR70XXXXX            # ← udid từ adb devices, KHÔNG phải emulator-5554
ANDROID_PLATFORM_VERSION=13                # check qua `adb shell getprop ro.build.version.release`
APP_PATH=./apps/SauceLabs-Demo-App.apk     # đường dẫn local hoặc absolute
```

**Run:**

```bash
npm run test:smoke                # smoke 5 phút
npm run test:perf                 # perf — threshold real device đúng (P95 < 2000ms)
```

**Multi-device local song song:** tạo nhiều `.env.local.<name>` rồi
override `--config` flag — nhưng pattern này hiếm dùng, prefer BS matrix
(§1.3) cho multi-device.

### 1.3. BrowserStack — Android (cross-device matrix, 5 device)

**Khi dùng:** Smoke trước release, regression P0, verify cross-device
fragmentation (Pixel/Samsung/OnePlus, Android 12/13/14).

#### Step 1: Upload APK lên BS App Automate

```bash
# Sign in BrowserStack → Account → Settings → tạo Access Key
# Set vào shell hoặc .env.local:
export BS_USERNAME=phucdn7_XXXXXX
export BS_ACCESS_KEY=YYYYYYYYYYYYYYYY

# Upload APK — response trả về { app_url: "bs://abc123..." }
curl -u "$BS_USERNAME:$BS_ACCESS_KEY" \
  -X POST https://api-cloud.browserstack.com/app-automate/upload \
  -F "file=@./apps/SauceLabs-Demo-App.apk"
```

Copy `bs://abc123...` URL.

#### Step 2: `.env.local` config

```env
ENV_PROFILE=staging
BS_USERNAME=phucdn7_XXXXXX
BS_ACCESS_KEY=YYYYYYYYYYYYYYYY
BS_APP_URL=bs://abc123...     # ← URL từ step 1
```

#### Step 3: Run

```bash
# Single suite trên 5 device song song
npm run test:bs

# Matrix mode — 5 device tuần tự (BS quota safe)
npm run test:bs:matrix -- --sequential

# Matrix song song (cần BS plan parallel ≥ 5 session)
npm run test:bs:matrix -- --parallel

# Filter 1 device cụ thể
BS_DEVICE_FILTER=pixel-7-a13 npm run test:bs
```

**5 device available** (`src/config/wdio.bs.ts:65-71`):
`pixel-7-a13`, `pixel-6-a12`, `galaxy-s22-a12`, `oneplus-11-a13`,
`pixel-8-a14`.

#### Step 4: Xem session

BS dashboard: https://app-automate.browserstack.com → filter buildName
`m6-bs-...` → mỗi session có video + device log + network log + Appium
log đầy đủ.

#### APK lifecycle

- BS giữ APK 30 ngày kể từ last access. Re-upload mỗi khi build mới.
- App có version cũ trùng tên cũng được — BS dùng URL hash, không
  conflict.
- List app đã upload: `curl -u $BS_USERNAME:$BS_ACCESS_KEY https://api-cloud.browserstack.com/app-automate/recent_apps`

### 1.4. BrowserStack — iOS (M6 spike, smoke 1 spec)

**Khi dùng:** Verify framework chạy được trên iOS (cross-platform
coverage). M6 mới spike — chưa full coverage, không recommend regression
trên iOS production.

#### Step 1: Build/grab IPA

**Option A — pull pre-built:**
```bash
# Sauce Labs Demo iOS app — public release
curl -L -o ./apps/SauceLabs-Demo-App.ipa \
  https://github.com/saucelabs/my-demo-app-ios/releases/download/v2.0.5/SauceLabs.Mobile.Sample.iOS.ipa
```

**Option B — build local Xcode** (Mac only):
```bash
xcodebuild -workspace MyApp.xcworkspace -scheme MyApp \
  -configuration Release -sdk iphoneos archive \
  -archivePath build/MyApp.xcarchive

xcodebuild -exportArchive -archivePath build/MyApp.xcarchive \
  -exportPath build/ipa -exportOptionsPlist exportOptions.plist
```

#### Step 2: Upload IPA

```bash
curl -u "$BS_USERNAME:$BS_ACCESS_KEY" \
  -X POST https://api-cloud.browserstack.com/app-automate/upload \
  -F "file=@./apps/SauceLabs-Demo-App.ipa"
```

#### Step 3: `.env.local`

```env
BS_IOS_APP_URL=bs://ios_abc123...
```

#### Step 4: Run iOS spike

```bash
npx wdio run ./src/config/wdio.bs.ios.ts
```

Spec scope: `tests/smoke/login-ios.spike.ts` only — verify connect +
login flow + cart icon assertion.

**Verdict template:** `docs/spikes/ios-support.md` §4.

⚠️ **iOS gap M6 chưa close:** `LogCapture` chỉ support UiAutomator2 logs.
iOS regression cần viết `IosLogCaptureDeps` (XCUITest) — defer M7+.

---

## 2. APK / IPA management — best practice

### Naming convention

```
apps/
├── SauceLabs-Demo-App.apk           # Sauce Demo Android (commit-able, ~10MB)
├── SauceLabs-Demo-App.ipa           # Sauce Demo iOS    (commit-able, ~5MB)
├── prod-mobile-app-1.2.3.apk        # production build  (NOT commit — gitignored)
└── staging-mobile-app-1.2.3-rc.apk  # staging build     (NOT commit — gitignored)
```

**Rule:**
- Commit APK Sauce Demo (public, license OK) làm baseline cho dev mới
  setup.
- KHÔNG commit APK production/staging (size + IP). Lưu artifact
  registry (S3, BS app storage, internal Nexus).
- `.gitignore` đã chặn `apps/*.apk` ngoại trừ Sauce Demo.

### APP_PATH env behavior

```env
# Local file (relative to repo root)
APP_PATH=./apps/SauceLabs-Demo-App.apk

# Absolute path
APP_PATH=/home/user/builds/app-1.2.3.apk

# BS app URL (chỉ dùng với wdio.bs.ts — KHÔNG dùng wdio.local.ts)
BS_APP_URL=bs://abc123...
```

WDIO local config đọc `APP_PATH` cho cả emulator + real device. BS
config đọc `BS_APP_URL` (đã upload).

### Build APK test-debuggable từ source

Có scaffold Kotlin trong `apps/test-debuggable-src/` (D4 Kotlin sample).
Build:

```bash
npm run build:test-apk
# → output: apps/test-debuggable-app.apk
```

Use case: viết feature flag spike, test framework hook không phụ thuộc
production app.

---

## 3. Daily workflow — 3 use case chính

### Use case A: Ship feature mới (BRD → spec → ship)

**Story:** PM gửi BRD "Apply discount coupon ở checkout". Anh là QA
owner. Step-by-step:

#### A.0. Snapshot BRD vào repo

```bash
# Copy template
cp docs/requirements/_template-BRD.md \
   docs/requirements/BRD-coupon-checkout-2026-05-02.md

# Fill content từ Jira ticket / PM doc:
#   - Metadata (Feature ID, source link, status=READY_FOR_QA)
#   - Functional + Non-functional requirements
#   - Acceptance criteria (PM-defined, KHÔNG phải testcase)
#   - Edge cases PM đã nghĩ trước
#   - Open questions PM tự flag (nếu có)

git add docs/requirements/BRD-coupon-checkout-2026-05-02.md
git commit -m "docs(brd): snapshot coupon-checkout BRD v1"
```

⚠️ **BRD là immutable** — KHÔNG edit sau commit. Requirement change → tạo
file mới `-v2.md`. Source of truth vẫn là Jira/Linear, file này là
snapshot để traceability scenario YAML / contract / spec ngược về
requirement gốc.

Template chi tiết: `docs/requirements/_template-BRD.md` (11 section).

#### A.1. Phân tích requirement (`/test-requirement`)

```
/test-requirement

Input: docs/requirements/BRD-coupon-checkout-2026-05-02.md

Output: tests/scenarios/coupon-checkout.scenario.yaml
  - 5-8 testable scenario (positive, negative, perf, edge case)
  - Mỗi scenario có: test_id, type, priority, suite, given/when/then,
    acceptance_ref (link về AC trong BRD §10), automatable
  - clarify_needed: list ambiguity QA phát hiện → gửi PM
  - testability: fully_automatable / manual_only / partial / blockers
  - coverage: map AC → scenarios (uncovered_ac MUST empty trước contract)
```

Template chi tiết: `tests/scenarios/_template.scenario.yaml`.

⚠️ Bắt buộc trước khi viết code. Không skip.

#### A.1.5. Clarify ambiguity (QA ↔ PM loop)

Skill `/test-requirement` flag mọi ambiguity vào field `clarify_needed:`
trong scenario YAML. Mỗi entry có:

```yaml
- id: Q1
  scenario_ref: [TC_COUPON_NEG_002]
  question: Coupon expiry check theo UTC hay client timezone?
  why_blocking: Server-side validation logic ảnh hưởng test data factory.
  options: [A: UTC | B: Client tz]
  pm_answer: ""        # ← block contract step tới khi PM trả lời
  answered_by: ""
  answered_date: ""
```

**Process:**

1. QA copy block `clarify_needed` → paste vào Jira comment / Slack thread / PR description.
2. PM trả lời từng Q với option chọn (A/B/...) + lý do.
3. QA update `pm_answer`, `answered_by`, `answered_date` trong YAML.
4. Khi mọi `pm_answer` ≠ empty + `coverage.uncovered_ac == []` → set
   `status: READY_FOR_CONTRACT`.
5. Update BRD §9 (Open questions) với answer (cùng commit batch).

**Block rule:** `/assertion-contract` skill **refuse invoke** nếu scenario
YAML status ≠ `READY_FOR_CONTRACT`. Đây là gate ép QA clarify đầy đủ
trước khi technical work, không "đoán" requirement.

#### A.2. Design Assertion Contract (`/assertion-contract`)

```
/assertion-contract

Input: scenario YAML từ A.1.

Output: src/contracts/coupon-checkout.contract.yaml
  - Layer UI: visible discount line item, total updated correctly
  - Layer API: POST /apply-coupon → 200 + Zod schema match
  - Layer State: cart.discount_code populated, cart.total_cents reduced
  - Negative: invalid code → 400 + UI toast error
  - Performance: P95 apply < 1500ms
  - Severity từng assertion: critical / high / medium
```

⚠️ **Khoá quan trọng nhất** của framework. Không có contract = test UI-only = false-pass trap.

#### A.3. Setup test data (`/test-data-setup`)

```
/test-data-setup

Input: contract YAML.

Output: src/factories/CouponFactory.ts + account pool entry mới (nếu cần
account riêng cho discount eligibility).
```

#### A.4. Implement spec (`/test-implement`)

```
/test-implement

Input: contract YAML + factory.

Output:
  - src/pages/CheckoutPage.ts   (locator + action)
  - tests/regression/coupon-checkout.spec.ts (spec body)
  - Allure step phân chia rõ ràng (UI step / API step / State step)
```

⚠️ Skill này refuse nếu chưa có contract — guard chặn shortcut.

#### A.5. Run + verify

```bash
# Iterate trên emulator
npm run test:regression -- --spec tests/regression/coupon-checkout.spec.ts

# Verify pre-PR trên real device
ANDROID_DEVICE_NAME=R3CR70XXXXX npm run test:regression -- --spec ...

# Run 20x check stability (spec §6.4)
npm run test:smoke:20x
# → expect ≥ 19/20 pass, không phải 20/20 (chấp nhận flaky < 5%)
```

#### A.6. Open PR

```bash
git add src/pages/CheckoutPage.ts \
        src/contracts/coupon-checkout.contract.yaml \
        src/factories/CouponFactory.ts \
        tests/regression/coupon-checkout.spec.ts \
        tests/scenarios/coupon-checkout.scenario.yaml
git commit -m "feat(test): coupon checkout regression spec + contract"
gh pr create
```

CI tự chạy: lint → typecheck → unit test → smoke trên emulator → KPI gate
(M5+).

**Time estimate:** 2-3h cho 1 critical flow đầy đủ 5 step.

---

### Use case B: CI fail sáng nay (debug + fix)

**Story:** Sáng vào, CI nightly fail. Allure report show 3 spec đỏ.

#### B.1. Triage Allure report

```bash
# Local: download artifact + open
gh run download <run-id> -n allure-report
npm run allure:open

# Hoặc: GH Pages publish (M5 acceptance §5)
open https://<owner>.github.io/<repo>/allure/<run_id>/
```

Đọc 3 fail:
- `TC_LOGIN_001` — UI assertion timeout
- `TC_CART_002` — API 500
- `TC_PERF_LOGIN_001` — P95 4462ms vs threshold 2000ms

#### B.2. Invoke `/failure-rca` cho từng fail

```
/failure-rca

Input:
  - Test ID
  - First fail timestamp
  - Allure stack trace + screenshot
  - 3 last commit SHA (suspect)

Output: docs/rca/2026-05-02-TC_LOGIN_001.md (template auto-fill)
  - Category: BUG | SCRIPT_ISSUE | FLAKY | ENV_ISSUE | DATA_ISSUE
  - Layer: UI | API | STATE | PERF | INFRA
  - Reproducible: rerun N lần xác định
  - Root cause + technical detail
  - Route to: step 1-8
  - Loop closure checklist (8 item)
```

Reference: `docs/rca/2026-05-01-TC_PERF_LOGIN_001.md` là RCA mẫu đầu tiên.

#### B.3. Route fail đến đúng workflow step

| Category    | Route to step | Skill apply fix         | Assignee  |
|-------------|---------------|-------------------------|-----------|
| BUG         | 1 (req review) hoặc dev fix | dev_team apply | dev_team  |
| SCRIPT_ISSUE| 4 (implement) | `/test-implement` revise | qa_team   |
| FLAKY       | 5 (execute)   | flaky-detector quarantine | qa_team |
| ENV_ISSUE   | 3 (env setup) | `/test-data-setup` revise | devops |
| DATA_ISSUE  | 3 (env setup) | factory/account pool fix | qa_team |
| Wrong assert| 2 (contract)  | `/assertion-contract` revise | qa_team |
| Locator wrong| 4 (implement)| Self-heal PR review | qa_team |

#### B.4. Fix + verify

```bash
# Apply fix theo skill route
git checkout -b fix/<TC_ID>-<short-desc>

# Verify isolated ≥ 20 run
PERF_LOGIN_SLA_MS=5000 npm run test:smoke:20x -- --spec tests/perf/login-perf.spec.ts
# → expect ≥ 19/20 pass

# Update RCA file Verification table + Loop closure checklist
# Commit + PR
git commit -m "fix(test): TC_PERF_LOGIN_001 emulator threshold override"
gh pr create
```

#### B.5. Close loop

- KB entry auto-append qua `node src/utils/kb/appender.ts` (CI hoặc manual).
- Update `docs/flaky_kb.md` `Links → RCA` trỏ về RCA file.
- Tick 8 checkbox trong RCA file.

**Time estimate:** 30 phút cho 1 fail không phức tạp. 2h nếu cần debug
deep (race condition, threading).

---

### Use case C: Release cycle (3 gate)

**Story:** Mobile team release 1.2.3-rc1. QA pipeline trigger 3 gate.

#### C.1. Gate 1 — PR merge gate (smoke 5 phút)

Tự động trên mỗi PR:
```yaml
# .github/workflows/ci.yml
- npm run lint
- npm run typecheck
- npm run test:unit
- npm run test:smoke      # block merge nếu fail
```

Block merge nếu smoke fail. Bypass: chỉ với label `flag:hotfix` + 2 reviewer approve.

#### C.2. Gate 2 — merge to main (regression 15 phút)

```yaml
# .github/workflows/regression.yml
on: { push: { branches: [main] } }
- npm run test:regression    # block deploy nếu fail
- npm run check:quarantine   # ngừng nếu quarantine list bùng nổ
```

#### C.3. Gate 3 — nightly (perf + visual + KPI)

```yaml
# Cron 02:00 UTC
- npm run test:perf
- npm run test:visual
- node scripts/check-kpi-window.cjs --soft  # 14d window check
- node scripts/analytics-trend.cjs           # forecast
- node scripts/maintenance-cost.cjs          # cost report
```

Thứ 2 tuần kế: review KPI dashboard, refresh ROI report.

**Pre-prod release decision:**

```
Smoke ✅ + Regression ✅ + KPI dashboard 4 critical green ≥ 10/14 ngày
+ Perf P95 không regression > 20%
→ GO release.
```

---

## 4. Worked example end-to-end — "Apply coupon" feature

**Setup:** Mobile team merge feature `apply-coupon` vào staging branch.
QA owner = Phuc.

### Day 1 — viết test

```bash
# 09:00 — Read PRD, invoke /test-requirement
# Output: tests/scenarios/coupon-checkout.scenario.yaml (5 scenario)

# 10:00 — Invoke /assertion-contract
# Output: src/contracts/coupon-checkout.contract.yaml
#   - 3 positive (valid code 10%/20%/free shipping)
#   - 2 negative (invalid code, expired code)
#   - Perf: apply < 1500ms

# 11:00 — Invoke /test-data-setup
# Output: src/factories/CouponFactory.ts (TestCoupon10pct, TestCoupon20pct,
#         TestCouponExpired, TestCouponInvalid)

# 13:00 — Invoke /test-implement
# Output: src/pages/CheckoutPage.ts (thêm 4 method)
#         tests/regression/coupon-checkout.spec.ts (5 it)

# 15:00 — Run trên emulator
npm run test:regression -- --spec tests/regression/coupon-checkout.spec.ts
# → 4/5 pass, 1 fail (selector ~test-coupon-input không tồn tại)

# 15:30 — Self-heal AI suggest selector mới
node scripts/self-heal-pr.cjs --spec tests/regression/coupon-checkout.spec.ts
# → tạo PR draft với locator update

# 16:00 — Review PR self-heal, approve
# 16:15 — Re-run, 5/5 pass

# 17:00 — Verify trên real device
ANDROID_DEVICE_NAME=R3CR70XXXXX npm run test:regression -- --spec ...
# → 5/5 pass

# 17:30 — npm run test:smoke:20x check stability
# → 20/20 pass

# 17:45 — Open PR
git push origin feat/coupon-checkout-spec
gh pr create --title "feat(test): coupon checkout regression spec + contract"
```

### Day 2 — CI fail nightly

```bash
# 09:00 — CI nightly fail
# TC_COUPON_002 fail trên BS Pixel 6 / Android 12 — UI timeout

# 09:15 — /failure-rca → docs/rca/2026-05-03-TC_COUPON_002.md
#   Category: SCRIPT_ISSUE
#   Layer: UI
#   Root cause: animation duration trên A12 chậm hơn A13 200ms,
#     waitUntil timeout 3000ms không đủ.

# 09:30 — Fix waitUntil timeout 3000 → 5000
# 09:45 — Verify 20x trên emulator A12 image: 20/20 pass

# 10:00 — PR fix → merge → KB auto-append
```

### Day 7 — release decision

```bash
# Read KPI dashboard:
#   - Genuine pass rate: 96.2% ✅
#   - Flaky rate: 2.1%      ✅
#   - Perf P95: 1340ms      ✅ (< 1500ms threshold)
#   - Visual diff: 0 fail    ✅

# Review docs/m6-roi-report.md trend table → 4 week ratio = 0.34
# Conclusion: GO release 1.2.3.
```

---

## 5. Decision matrix — when to use what

### Test scope

| Tôi muốn... | Suite | Time | Trigger |
|-------------|-------|------|---------|
| Verify PR không break critical path | smoke | 5min | PR merge gate |
| Verify merge main không break full coverage | regression | 15min | Push main |
| Catch perf regression | perf | 10min | Nightly |
| Catch UI visual diff | visual | 8min | Nightly |
| Catch edge case + long-running | nightly | 30min | Cron 02:00 |
| Verify negative path (invalid input) | negative | 5min | Per-spec selective |

### Mode chạy

| Tình huống | Mode | Lý do |
|-----------|------|-------|
| Iterate spec mới (đổi locator vài chục lần) | Local emulator | Fastest, không tốn BS quota |
| Verify pre-PR | Real device USB | Threshold perf đúng, real network |
| PR merge gate CI | BS single device (Pixel 7) | Cost-effective, đủ stability signal |
| Nightly regression | BS matrix 5 device | Cross-device fragmentation coverage |
| iOS verify | BS iPhone 14 | M7+ mới full, hiện tại spike only |

### Skill invocation

| Khi... | Skill | Block-merge nếu thiếu? |
|--------|-------|------------------------|
| Có PRD mới chưa có scenario | `/test-requirement` | ❌ no (manual gate) |
| Có scenario chưa có contract | `/assertion-contract` | ✅ yes — `/test-implement` refuse |
| Có contract chưa có data | `/test-data-setup` | ⚠️ recommended |
| Có data chưa có spec | `/test-implement` | — |
| Spec fail ≥ 1 lần | `/failure-rca` | ⚠️ required khi route step 7 |
| Spec migration / cleanup | `/test-review` | ✅ block-merge nếu anti-pattern |

### Validation verdict (`/test-validate`)

| Verdict | Action |
|---------|--------|
| GENUINE_PASS | Ship |
| FALSE_PASS | Add layer (API/State) trong contract |
| FLAKY | Auto-quarantine + log debt repay sprint kế |
| BUG | Route step 1, assign dev_team |

---

## 6. FAQ

**Q1. Tôi mới onboard, không biết bắt đầu từ đâu?**

A: Đọc theo thứ tự:
1. `automation_testing_requirement.md` (spec) §1-§6 — 30 phút.
2. `docs/framework-usage-guide.md` (file này) — 20 phút.
3. `docs/runbook-operations.md` §1 TL;DR — 10 phút.
4. Clone + run `npm run test:smoke` trên emulator — 30 phút.
Tổng 1.5h là đủ kick start.

**Q2. Tôi không có Mac, build IPA iOS sao?**

A: Không cần build local — pull pre-built IPA Sauce Demo (§1.4 step 1
option A) hoặc nhờ teammate có Mac build. iOS spike M6 chỉ cần 1 IPA
chạy thử, không phải pipeline build.

**Q3. BS quota cạn, làm sao?**

A: Fallback theo Decision 3 (M6 plan):
- 1 real device USB tại bàn + 0-1 BS device → scope giảm matrix còn 2.
- Document fallback trong PR description + closure evidence.
- Renew quota tháng sau.

**Q4. Test pass local nhưng fail CI / fail BS, tại sao?**

A: 90% là 1 trong 3 nguyên nhân:
1. Env diff: `.env.local` khác CI env → check `process.env.CI` để branch logic.
2. Animation/timing: emulator nhanh hơn real device → tăng waitUntil timeout.
3. Account pool exhausted: rerun trùng account chưa release → check `tmp/account-pool.state.json`.

`/failure-rca` giúp identify chính xác.

**Q5. Tôi muốn skip framework, chạy 1 test 1 lần thôi?**

A: OK với 3 trường hợp:
- Manual exploratory test (không cần Assertion Contract).
- Hotfix critical < 30 phút (skip framework, log debt sau).
- Unit test (Jest/Mocha thuần, không qua Appium).

Các trường hợp khác — KHÔNG skip. Shortcut sẽ thành debt và là root
cause của false-pass / flaky / maintenance ngốn thời gian (đúng cái
framework giải).

**Q6. Self-heal làm sao biết khi nào AI suggest đúng?**

A: AI **không bao giờ auto-apply** vào main. Suggest = mở PR draft. QA
review → approve hoặc reject. Reject 3 lần liên tiếp cùng test → escalate
manual fix (khả năng AI hallucinate locator).

**Q7. Tôi muốn thêm 1 layer assertion mới (vd. log layer)?**

A: Update Assertion Contract YAML schema (`src/contracts/_schema.yaml`)
+ thêm validator trong `src/utils/assertion-runner/`. Đây là framework
extension — propose qua plan template `docs/plans/_template.md` trước
khi implement.

**Q8. Framework không support feature flag testing?**

A: D5 (M4 debt) — feature flag PR walkthrough có sẵn trong
`docs/runbook-pr-merge-gate.md`. Spec chưa native support feature flag
ở Assertion Contract — defer M7+.

---

## 7. Cross-references

- **Spec gốc:** `automation_testing_requirement.md` (§1-§11)
- **Operational runbook:** `docs/runbook-operations.md` (process daily/weekly/monthly)
- **M6 acceptance:** `docs/runbook-M6-acceptance.md` (8 § sign-off)
- **ROI report:** `docs/m6-roi-report.md` (formula + trend)
- **iOS spike:** `docs/spikes/ios-support.md`
- **RCA samples:** `docs/rca/2026-05-01-TC_PERF_LOGIN_001.md`
- **BRD template:** `docs/requirements/_template-BRD.md`
- **Scenario template:** `tests/scenarios/_template.scenario.yaml`
- **Contract samples:** `src/contracts/AC_*.yaml`
- **Plan tracking:** `ROADMAP.md` + `docs/plans/MX-*.md`
- **Skills:** `.claude/skills/` (7 skill mapping spec step 1-7 + cross-cutting)

---

## 8. Update cadence của doc này

- **Mỗi khi spec major revision** (M7+ scope thay đổi).
- **Mỗi khi mode chạy mới** (vd. add Sauce Labs config, add Firebase Test Lab).
- **Mỗi quý** review FAQ — gom câu hỏi từ team channel vào.

Owner: Phuc DN. Last updated: 2026-05-02.
