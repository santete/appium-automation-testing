# 🧪 Automation Testing System — Requirement Document

> **Phiên bản:** 1.0
> **Domain:** Mobile Automation Testing (Appium + TypeScript)
> **Mô hình:** Human-in-the-Loop Orchestrator
> **Mục tiêu:** Xây dựng hệ thống test **đáng tin cậy (trustworthy)**, không chỉ "chạy được"

---

## 📑 Mục lục

1. [Triết lý & Nguyên tắc cốt lõi](#1-triết-lý--nguyên-tắc-cốt-lõi)
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
3. [Workflow chi tiết 8 bước](#3-workflow-chi-tiết-8-bước)
4. [Test Data & Environment Strategy](#4-test-data--environment-strategy)
5. [Assertion Contract Framework](#5-assertion-contract-framework)
6. [Feedback Loop Routing](#6-feedback-loop-routing)
7. [CI/CD & Reporting Architecture](#7-cicd--reporting-architecture)
8. [KPI & Metrics](#8-kpi--metrics)
9. [Anti-patterns cần tránh](#9-anti-patterns-cần-tránh)
10. [Tech Stack đề xuất](#10-tech-stack-đề-xuất)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Triết lý & Nguyên tắc cốt lõi

### 1.1. Định nghĩa lại vai trò Automation Engineer

> Automation engineer KHÔNG phải là người "viết test"
> mà là người **đảm bảo chất lượng của hệ thống test**

```
Requirement → Test Design → Automation → Validation → Analysis → Improvement
                              (loop liên tục, có feedback đúng địa chỉ)
```

### 1.2. Test Trustworthiness Pyramid

```
              ┌────────────────┐
              │   Reliable     │  ← Ổn định, ít flaky
              ├────────────────┤
              │  Meaningful    │  ← Đúng assertion, đúng scope
              ├────────────────┤
              │ Maintainable   │  ← Dễ sửa khi app thay đổi
              ├────────────────┤
              │  Traceable     │  ← Biết tại sao pass/fail
              └────────────────┘
```

Một test KHÔNG đủ cả 4 tầng → là **technical debt**, không phải tài sản.

### 1.3. Nguyên tắc bất di bất dịch

| Nguyên tắc | Giải thích |
|------------|------------|
| **PASS ≠ Correct** | Pass chỉ có nghĩa "không có gì fail", không có nghĩa "đúng" |
| **Validation = Multi-layer** | UI + API + Data, thiếu 1 lớp = false confidence |
| **Test phải reproducible** | Chạy 10 lần, kết quả phải giống nhau trên mọi env |
| **Test phải isolated** | Không phụ thuộc thứ tự, không phụ thuộc test khác |
| **Test phải có địa chỉ** | Khi fail, phải biết route về đâu (bug? script? env?) |
| **Human-in-the-loop** | AI/automation chỉ suggest, human approve |

---

## 2. Kiến trúc tổng thể

### 2.1. Workflow chính (với feedback loop đúng địa chỉ)

```
┌─────────────────────────────────────────────────────────────┐
│              AUTOMATION TESTING SYSTEM                       │
└─────────────────────────────────────────────────────────────┘

  [1. Requirement Analysis]
         │ (testable scenarios + acceptance criteria)
         ↓
  [2. Test Strategy & Validation Design] ──── Assertion Contract
         │ (test plan + assertion contract)
         ↓
  [3. Test Data & Environment Setup]
         │ (data fixtures + env config)
         ↓
  [4. Implement Automation]
         │ (page objects + specs + utils)
         ↓
  [5. Execute & Observe]
         │ (logs + screenshots + traces)
         ↓
  [6. Validate Result] ←── (đối chiếu với Assertion Contract)
         │
         ├──── BUG (app lỗi thật) ─────────────→ feedback to [1] hoặc [2]
         ├──── SCRIPT ISSUE ───────────────────→ feedback to [4]
         ├──── FLAKY ──────────────────────────→ feedback to [5]
         ├──── DATA/ENV ISSUE ─────────────────→ feedback to [3]
         └──── GENUINE PASS ──────→ [7. Analysis & Report]
                                            │
                                            ↓
                                    [8. Improve & Stabilize]
                                            │
                                            └──→ LOOP
```

### 2.2. Layered Architecture

```
┌──────────────────────────────────────────────────────┐
│  Layer 5: Reporting & Analytics                      │  ← Allure / Custom Dashboard
├──────────────────────────────────────────────────────┤
│  Layer 4: Orchestration & CI/CD                      │  ← GitHub Actions / Jenkins
├──────────────────────────────────────────────────────┤
│  Layer 3: Test Logic (Specs + Page Objects)          │  ← TypeScript test code
├──────────────────────────────────────────────────────┤
│  Layer 2: Test Infrastructure                        │  ← Appium, WDIO, drivers
├──────────────────────────────────────────────────────┤
│  Layer 1: Test Data & Environment                    │  ← Fixtures, mocks, env config
└──────────────────────────────────────────────────────┘
```

Mỗi layer phải:
- Độc lập với layer khác (decoupled)
- Có thể test/swap riêng (testable)
- Có ownership rõ ràng (responsibility)

---

## 3. Workflow chi tiết 8 bước

### 🟢 Step 1 — Requirement Analysis

**Mục tiêu:** Hiểu đúng business logic, xác định "đúng là gì".

**Hoạt động:**
- Đọc PRD / user story / acceptance criteria
- Phỏng vấn PO/BA nếu requirement không rõ
- **Testability Assessment** — không phải requirement nào cũng nên automate

**Testability Checklist:**

| Tiêu chí | Pass | Fail |
|----------|------|------|
| Có stable locator/API contract? | ✅ Automate | ❌ Manual |
| Test data reproducible? | ✅ Automate | ❌ Manual |
| Expected behavior deterministic? | ✅ Automate | ❌ Manual |
| Có thể reset state sau test? | ✅ Automate | ❌ Manual |
| ROI > effort maintain? | ✅ Automate | ❌ Manual |

**Artifact:** `Test Scenario Document`

```yaml
scenario_id: TC_LOGIN_001
flow: User Login
priority: P0 (critical)
testability: AUTOMATABLE

input:
  username: valid_user
  password: valid_pass

expected:
  ui:
    - redirect to Home screen
    - username displayed in header
  api:
    - POST /auth/login → 200
    - response contains: token, refresh_token, expires_in
  state:
    - token persisted in secure storage
    - session timer started
```

---

### 🟡 Step 2 — Test Strategy & Validation Design

**Mục tiêu:** Quyết định test gì, không test gì, validate thế nào.

**Test Pyramid cho Mobile:**

```
              ┌──────────┐
              │  E2E UI  │  ← Appium, ~10% (chỉ critical flow)
              └──────────┘
           ┌──────────────────┐
           │  API Integration │  ← ~30% (business logic)
           └──────────────────┘
        ┌────────────────────────┐
        │  Unit / Component      │  ← ~60% (dev responsibility)
        └────────────────────────┘
```

**Test Categorization:**

| Loại | Mục đích | Tần suất chạy |
|------|----------|---------------|
| Smoke | Critical path only (login, payment) | Mỗi PR |
| Regression | Full coverage | Mỗi merge to main |
| Negative | Invalid input, error handling | Regression |
| Edge case | Boundary, race condition | Nightly |
| Performance | Response time, memory | Nightly |

**Output bắt buộc:** Mỗi test case phải có **Assertion Contract** (xem section 5).

---

### 🟠 Step 3 — Test Data & Environment Setup

> Đây là step **bị bỏ qua nhiều nhất** và là **nguyên nhân #1 gây flaky test**.

Chi tiết đầy đủ ở [section 4](#4-test-data--environment-strategy).

**Tóm tắt:**
- Phân loại test data (static / dynamic / generated)
- Định nghĩa lifecycle (setup → use → cleanup)
- Config environment matrix
- Account pool management

---

### 🔵 Step 4 — Implement Automation

**Mục tiêu:** Viết test code maintain được, không phải code chạy được.

**Patterns bắt buộc:**

**a) Page Object Model (cơ bản)**

```typescript
// pages/LoginPage.ts
export class LoginPage {
  private readonly usernameInput = '~login_username_input';
  private readonly passwordInput = '~login_password_input';
  private readonly submitButton = '~login_submit_button';

  async login(username: string, password: string): Promise<void> {
    await $(this.usernameInput).setValue(username);
    await $(this.passwordInput).setValue(password);
    await $(this.submitButton).click();
  }
}
```

**b) Screenplay Pattern (cho complex flow)**

```typescript
// Actor → Task → Interaction → Question
await actor.attemptsTo(
  Login.withCredentials(user, pass),
  Navigate.to(HomeScreen)
);

const isLoggedIn = await actor.asks(HomeScreen.isVisible());
expect(isLoggedIn).toBe(true);
```

**c) Wait Strategy (KHÔNG dùng sleep)**

```typescript
// ❌ WRONG
await browser.pause(3000);

// ✅ RIGHT — explicit wait với điều kiện rõ ràng
await browser.waitUntil(
  async () => await $(loginButton).isClickable(),
  {
    timeout: 10000,
    interval: 500,
    timeoutMsg: 'Login button not clickable after 10s'
  }
);
```

**d) Soft Assertion (collect all failures)**

```typescript
expect.soft(ui.homeTitle).toBe('Home');
expect.soft(api.statusCode).toBe(200);
expect.soft(storage.token).toBeDefined();
// Báo cáo TẤT CẢ failure trong 1 lần chạy
```

**Code Structure:**

```
project/
├── src/
│   ├── pages/           # Page Objects
│   ├── tasks/           # Screenplay tasks
│   ├── questions/       # Screenplay questions
│   ├── fixtures/        # Test data
│   ├── utils/           # Helpers (wait, logger, api client)
│   ├── config/          # Env config
│   └── types/           # TypeScript types
├── tests/
│   ├── smoke/
│   ├── regression/
│   └── negative/
├── reports/
└── wdio.conf.ts
```

---

### 🟣 Step 5 — Execute & Observe

**Mục tiêu:** KHÔNG chỉ chạy → phải **quan sát** để có dữ liệu debug sau này.

**Execution Modes:**

| Mode | Mục đích | Config |
|------|----------|--------|
| Local | Debug, develop test mới | Verbose log, single device, headed |
| CI | Validate PR | Parallel, headless, retry x2 |
| Nightly | Full regression | All devices, screen recording |
| Production smoke | Verify deployment | Read-only, sandbox account |

**Observability Stack — bắt buộc thu thập:**

```yaml
per_test_run:
  - step_logs:
      timestamp: ISO8601
      action: string
      element: locator
      result: pass | fail | error
  - screenshots:
      on_step: optional (configurable)
      on_fail: required
      before_critical_action: required
  - video_recording:
      enabled: in CI/Nightly
  - network_trace:
      api_calls_during_ui_test: captured
      format: HAR
  - device_metrics:
      memory_usage: sampled
      cpu_usage: sampled
      battery: sampled
  - console_logs:
      app_logs: captured
      crash_reports: captured
```

---

### 🔴 Step 6 — Validate Result (CRITICAL)

**Mục tiêu:** Xác định PASS có **thật** không (genuine pass vs false pass).

**Validation Decision Matrix:**

| UI | API | Data/State | Verdict |
|----|-----|------------|---------|
| ✅ Pass | ✅ Pass | ✅ Pass | **GENUINE PASS** |
| ✅ Pass | ❌ Fail | any | **FALSE PASS** ⚠️ (UI lừa) |
| ❌ Fail | ✅ Pass | ✅ Pass | UI Bug |
| ✅ Pass | ✅ Pass | ❌ Fail | Data/State Bug |
| Intermittent | any | any | **FLAKY** → investigate |
| Timeout | Timeout | n/a | Env/Infra issue |

**Output:** Validation Report

```yaml
test_id: TC_LOGIN_001
verdict: FALSE_PASS
layers:
  ui:
    status: pass
    evidence: screenshot_home.png
  api:
    status: fail
    evidence: response token=null
  state:
    status: pass
    evidence: storage_dump.json
root_layer: api
recommended_action: report as bug
```

---

### ⚫ Step 7 — Analyze & Debug

**Mục tiêu:** Tìm root cause, classify đúng để route feedback (xem [section 6](#6-feedback-loop-routing)).

**RCA Template:**

```yaml
test_id: TC_LOGIN_001
result: FAIL (intermittent — 3/10 runs)

timeline:
  - 08:01:23 → tap login button
  - 08:01:24 → element not found (LoginButton)
  - 08:01:24 → test fail

category: FLAKY (not app bug)

root_cause:
  description: Animation chưa hoàn tất khi tap
  evidence: video recording at 00:23
  technical: Element exists nhưng not interactable

fix:
  change: Replace findElement() with waitForClickable()
  timeout: 3000ms
  file: pages/LoginPage.ts:42

verification:
  before_fix: 7/10 pass
  after_fix: 20/20 pass
  
feedback_route: Step 5 (execution strategy)
```

---

### ⚪ Step 8 — Improve & Stabilize

**2 loại improvement:**

**Type 1 — Stabilization (reactive):**
- Trigger: test fail/flaky/false-pass
- Action: fix locator, add wait, fix assertion
- Owner: tester phát hiện vấn đề

**Type 2 — Evolution (proactive):**
- Trigger: app thay đổi, feature mới, refactor
- Action: update test design, review coverage, retire test cũ
- Owner: lead QA, schedule mỗi sprint

**Improvement Log:**

```yaml
date: 2026-04-27
type: stabilization
test_id: TC_LOGIN_001
issue: flaky 30%
fix: 
  - replace pause() with waitForClickable()
  - add network mock for slow API
result:
  flaky_rate_before: 30%
  flaky_rate_after: 0% (verified 50 runs)
```

---

## 4. Test Data & Environment Strategy

> Đây là phần được bổ sung mới — **không có trong document gốc** nhưng là nguyên nhân lớn nhất gây flaky test.

### 4.1. Test Data Classification

```
                    Test Data
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   ┌───────┐      ┌─────────┐    ┌──────────┐
   │Static │      │ Dynamic │    │Generated │
   └───────┘      └─────────┘    └──────────┘
   Fixture        Factory        Faker/Random
   (JSON/YAML)    Function       (per run)
```

| Loại | Khi nào dùng | Ví dụ |
|------|--------------|-------|
| **Static** | Data ổn định, dùng cho lookup | Country list, currency codes |
| **Dynamic** | Data cần unique mỗi run | User account, order ID |
| **Generated** | Data ngẫu nhiên cho stress/edge | Random strings, fake email |

### 4.2. Test Data Lifecycle

```
   ┌─────────┐      ┌──────┐      ┌──────────┐
   │ Setup   │ ───→ │ Use  │ ───→ │ Cleanup  │
   └─────────┘      └──────┘      └──────────┘
   - seed DB        - test runs   - delete data
   - create user    - assertions  - reset state
   - mock service                 - teardown
```

**Nguyên tắc bất biến:**

```typescript
beforeEach(async () => {
  // Setup — tạo data fresh cho mỗi test
  testUser = await UserFactory.create();
});

afterEach(async () => {
  // Cleanup — xóa data sau test, BẤT KỂ pass/fail
  await UserFactory.cleanup(testUser.id);
});

// ❌ WRONG: dùng chung data giữa các test
const SHARED_USER = { id: 1, name: 'test' };

// ✅ RIGHT: mỗi test có data riêng, isolated
```

### 4.3. Account Pool Management

Cho mobile testing, cần pool tài khoản test riêng:

```yaml
test_account_pool:
  total: 100
  states:
    - fresh:     20  # chưa dùng, ready
    - in_use:    5   # đang được test khác chiếm
    - cooling:   10  # vừa dùng xong, chờ reset
    - exhausted: 5   # cần manual cleanup

allocation_strategy:
  - lock account before test
  - release after test (with state cleanup)
  - timeout: 30 min (auto-release nếu test crash)
  - rotation: round-robin để tránh rate limit
```

### 4.4. Environment Matrix

```yaml
environments:
  local:
    purpose: Develop test mới
    data: Local DB, mock services
    devices: 1 emulator
    
  staging:
    purpose: CI/CD validation
    data: Staging DB (refreshed daily)
    devices: BrowserStack / Sauce Labs farm
    
  pre_prod:
    purpose: Final validation trước release
    data: Production-like data (anonymized)
    devices: Real device farm
    
  production:
    purpose: Smoke test sau deploy
    data: Sandbox accounts, read-only
    devices: 1-2 real devices
    constraint: KHÔNG chạy test phá hoại
```

### 4.5. Config Management

```typescript
// config/index.ts
export const config = {
  baseUrl: process.env.BASE_URL!,
  apiUrl: process.env.API_URL!,
  testAccountPoolUrl: process.env.ACCOUNT_POOL_URL!,
  retryCount: parseInt(process.env.RETRY_COUNT || '0'),
  // ❌ NEVER hardcode credentials
  // ❌ NEVER commit .env files
};

// .env.staging (gitignored)
BASE_URL=https://staging.app.com
API_URL=https://api-staging.app.com
ACCOUNT_POOL_URL=https://pool-staging.internal
```

### 4.6. Network Simulation

Mobile test phải cover các network condition:

| Condition | Mục đích | Tool |
|-----------|----------|------|
| WiFi (good) | Happy path | Default |
| 3G (slow) | Performance regression | Chrome DevTools / Charles |
| Offline | Error handling | Appium network throttle |
| Flaky (packet loss) | Resilience | Toxiproxy |

### 4.7. Service Mocking Strategy

```
┌─────────────────────────────────────────────┐
│  Khi nào dùng real API vs mock?             │
├──────────────────────┬──────────────────────┤
│  Real API            │  Mock                │
├──────────────────────┼──────────────────────┤
│ - E2E happy path     │ - Error scenarios    │
│ - Contract testing   │ - Edge cases (rare)  │
│ - Integration        │ - Slow/unstable APIs │
│                      │ - 3rd party (paid)   │
└──────────────────────┴──────────────────────┘
```

Tool đề xuất: **WireMock**, **MSW**, **Mockoon**.

---

## 5. Assertion Contract Framework

> **Insight quan trọng:** Assertion phải được **design từ Step 2**, không phải nghĩ ra khi viết code ở Step 4.

### 5.1. Assertion Contract là gì?

> Một **bản hợp đồng** xác định ĐÚNG/SAI cho mỗi test case, ở **nhiều layer**, có **cả positive và negative**.

### 5.2. Cấu trúc Assertion Contract

```yaml
# assertion_contracts/login_success.yaml

contract_id: AC_LOGIN_001
test_scenario: TC_LOGIN_001
description: User logs in with valid credentials

# ─── POSITIVE ASSERTIONS ───
positive:
  ui_layer:
    - id: ui.redirect
      check: current_screen == "Home"
      severity: critical
    - id: ui.username_displayed
      check: header.username == ${input.username}
      severity: critical
    - id: ui.no_error_toast
      check: error_toast.visible == false
      severity: critical
  
  api_layer:
    - id: api.login_status
      check: POST /auth/login → status == 200
      severity: critical
    - id: api.response_schema
      check: response matches LoginResponseSchema
      severity: critical
    - id: api.token_format
      check: response.token matches /^eyJ[A-Za-z0-9-_]+/
      severity: high
  
  state_layer:
    - id: state.token_persisted
      check: secureStorage.get("auth_token") != null
      severity: critical
    - id: state.session_started
      check: sessionTimer.isRunning == true
      severity: high

# ─── NEGATIVE ASSERTIONS ───
# Những thứ KHÔNG được phép xảy ra
negative:
  - id: neg.no_console_error
    check: console.errors.length == 0
    severity: medium
  - id: neg.no_crash
    check: app.crashed == false
    severity: critical
  - id: neg.no_pii_in_logs
    check: logs NOT contains password
    severity: critical (security)

# ─── PERFORMANCE ASSERTIONS ───
performance:
  - id: perf.login_duration
    check: time(tap_login → home_visible) < 3000ms
    severity: high
  - id: perf.api_response
    check: api.response_time < 2000ms
    severity: high

# ─── VISUAL ASSERTIONS (optional) ───
visual:
  - id: visual.home_layout
    check: screenshot_diff(home_screen, baseline) < 1%
    severity: low
```

### 5.3. Severity Levels

| Severity | Action khi fail | Ví dụ |
|----------|-----------------|-------|
| **Critical** | Stop test, mark FAIL | Login không redirect |
| **High** | Continue, mark FAIL ở cuối | Performance vượt SLA |
| **Medium** | Continue, log warning | Console error |
| **Low** | Continue, info only | Visual diff nhỏ |

### 5.4. Assertion Composition

```typescript
// utils/assertion.ts
export class AssertionRunner {
  private results: AssertionResult[] = [];
  
  async runContract(contract: AssertionContract): Promise<Verdict> {
    // Run all assertions, collect results
    for (const assertion of contract.positive.flat()) {
      const result = await this.execute(assertion);
      this.results.push(result);
      
      if (assertion.severity === 'critical' && !result.passed) {
        return { verdict: 'FAIL', stopEarly: true, results: this.results };
      }
    }
    
    return this.computeVerdict();
  }
  
  private computeVerdict(): Verdict {
    const failed = this.results.filter(r => !r.passed);
    const criticalFailed = failed.filter(r => r.severity === 'critical');
    
    if (criticalFailed.length > 0) return { verdict: 'FAIL' };
    if (failed.length > 0) return { verdict: 'PASS_WITH_WARNINGS' };
    return { verdict: 'PASS' };
  }
}
```

### 5.5. Contract Testing (API Layer)

Sử dụng **Pact** hoặc **OpenAPI schema validation** để đảm bảo API response không bị breaking change:

```typescript
import { matchers } from '@pact-foundation/pact';

await provider.addInteraction({
  state: 'user exists',
  uponReceiving: 'a login request',
  withRequest: {
    method: 'POST',
    path: '/auth/login',
    body: { username: 'test', password: 'pass' }
  },
  willRespondWith: {
    status: 200,
    body: {
      token: matchers.like('eyJhbGc...'),
      expiresIn: matchers.integer(3600)
    }
  }
});
```

### 5.6. Visual Regression (optional, dùng cho UI critical)

```typescript
// Dùng Applitools / Percy / resemblejs
await expect(await browser.takeScreenshot()).toMatchSnapshot({
  failureThreshold: 0.01,  // 1% diff
  failureThresholdType: 'percent'
});
```

**Nguyên tắc:** Visual regression chỉ áp dụng cho **screen quan trọng** (login, payment, checkout). KHÔNG dùng cho mọi screen → maintenance hell.

---

## 6. Feedback Loop Routing

> **Insight quan trọng:** Khi test fail, hệ thống phải **tự route** feedback về đúng step để fix, không phải lúc nào cũng "quay về đầu".

### 6.1. Failure Classification Tree

```
              [Test Fail]
                   │
        ┌──────────┴──────────┐
        │                     │
  Reproducible?         Not reproducible
        │                     │
        ↓                     ↓
   ┌─────────┐         ┌──────────┐
   │  Bug?   │         │  FLAKY   │ → Step 5
   └────┬────┘         └──────────┘
        │
   ┌────┴────────────────────┐
   │                         │
App behavior wrong?    Test logic wrong?
   │                         │
   ↓                         ↓
┌─────┐                ┌──────────────┐
│ BUG │ → Step 1/2     │ SCRIPT ISSUE │ → Step 4
└─────┘                └──────────────┘
   │
   │ env-related?
   ↓
┌──────────────┐
│ ENV/DATA     │ → Step 3
│ ISSUE        │
└──────────────┘
```

### 6.2. Routing Rules — Decision Table

| Symptom | Reproducible? | Layer fail | Verdict | Route to |
|---------|---------------|-----------|---------|----------|
| API 500 error | ✅ Yes | API | App Bug | Step 1 (requirement) hoặc dev team |
| UI missing element | ✅ Yes | UI | Có thể là bug HOẶC locator sai | Investigate → Step 4 hoặc dev |
| Test fail 3/10 runs | ❌ No | UI/API | Flaky | Step 5 (execution stability) |
| All tests fail in CI, pass locally | ✅ Yes (in CI) | Any | Env issue | Step 3 (env config) |
| Test data conflict | ✅ Yes | Data | Test isolation broken | Step 3 (data lifecycle) |
| Schema validation fail | ✅ Yes | API | Contract changed | Step 1 (requirement update) |
| Performance regression | ✅ Yes | Perf | Perf bug | Step 2 (review SLA) + dev |
| Test PASS but should FAIL | ✅ Yes | Assertion | Wrong assertion | Step 2 (contract design) |

### 6.3. Auto-Routing với Metadata

```typescript
// Mỗi failure phải có metadata để route
interface FailureMetadata {
  testId: string;
  category: 'BUG' | 'SCRIPT_ISSUE' | 'FLAKY' | 'ENV_ISSUE' | 'DATA_ISSUE';
  layer: 'UI' | 'API' | 'STATE' | 'PERF';
  reproducible: boolean;
  reproductionRate: number;  // 0-1
  
  rootCause: {
    description: string;
    evidence: string[];  // file paths
  };
  
  routeTo: WorkflowStep;  // 1-8
  assignTo: 'dev_team' | 'qa_team' | 'devops_team';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}
```

### 6.4. Loop Closure Verification

> Một feedback loop chỉ đóng khi: **fix đã verify, test không tái phát**.

```yaml
loop_closure_checklist:
  - issue_identified: ✅
  - root_cause_documented: ✅
  - fix_implemented: ✅
  - fix_verified_in_isolation: ✅  # chạy 20 lần liên tục, pass 20 lần
  - regression_check_passed: ✅    # các test khác không bị ảnh hưởng
  - rca_archived: ✅               # ghi vào knowledge base
```

### 6.5. Knowledge Base — Tích lũy kinh nghiệm

```yaml
# kb/flaky_patterns.yaml
patterns:
  - pattern: "Element exists but not interactable"
    frequency: 23 occurrences
    common_cause: Animation not finished
    common_fix: Use waitForClickable() instead of isExisting()
    
  - pattern: "Random API timeout in CI"
    frequency: 15 occurrences
    common_cause: Shared rate limit on test account
    common_fix: Implement account pool rotation
```

→ Cho phép junior engineer tự debug bằng cách tra knowledge base trước.

### 6.6. Human-in-the-Loop Decision Points

```
        [Auto-classified Failure]
                  │
          confidence > 0.9?
            │           │
           Yes          No
            │           │
            ↓           ↓
       [Auto-route]  [Human triage]
            │           │
            └─────┬─────┘
                  ↓
            [Human approve fix]
                  │
                  ↓
              [Apply fix]
```

**Nguyên tắc:** Auto-classify được, nhưng **fix luôn cần human approve**. Đặc biệt với self-healing locator → KHÔNG tự apply.

---

## 7. CI/CD & Reporting Architecture

> Không có CI/CD và reporting → workflow chỉ tồn tại trên giấy.

### 7.1. Pipeline Stages

```
┌─────────────────────────────────────────────────────────────┐
│                     CI/CD PIPELINE                          │
└─────────────────────────────────────────────────────────────┘

[Developer push code]
       │
       ↓
┌──────────────┐
│  Pre-commit  │  ← Lint, format, type-check (local hook)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   PR open    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ Smoke Test   │  ← 5-7 phút, critical flow only
│ (parallel)   │     Block merge nếu fail
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ Merge to main│
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ Regression   │  ← 20-30 phút, full coverage
│ (parallel)   │     Notify nếu fail
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   Deploy     │
│   Staging    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ Post-deploy  │  ← Smoke trên staging real
│ Smoke        │
└──────────────┘

[Nightly] ───→ Full suite + Performance + Visual regression (1-2h)
[Weekly]  ───→ Cross-device matrix, compatibility (4-6h)
```

### 7.2. Pipeline Configuration Example (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Mobile Automation Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # 2AM nightly

jobs:
  smoke:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]  # parallel 4 shards
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run smoke tests
        run: npm run test:smoke -- --shard=${{ matrix.shard }}/4
        env:
          BROWSERSTACK_USER: ${{ secrets.BS_USER }}
          BROWSERSTACK_KEY: ${{ secrets.BS_KEY }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: results-${{ matrix.shard }}
          path: ./reports

  regression:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      # ... full regression
```

### 7.3. Parallelization Strategy

| Strategy | Khi dùng | Trade-off |
|----------|----------|-----------|
| **By test file** | Default, đơn giản | Không cân bằng nếu file dài/ngắn khác nhau |
| **By test case** | Suite lớn, cần balance | Cần test isolation chặt |
| **By device** | Cross-device test | Tốn device farm slot |
| **By feature** | Suite có domain rõ | Phụ thuộc structure |

**Đề xuất:** Sharding theo test case + isolation chặt + account pool rotation.

### 7.4. Reporting Layer

```
┌─────────────────────────────────────────────┐
│           Test Execution                    │
└──────────────────┬──────────────────────────┘
                   │ raw events
                   ↓
┌─────────────────────────────────────────────┐
│         Event Collector                     │
│  (capture: logs, screenshots, video, HAR)   │
└──────────────────┬──────────────────────────┘
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
   ┌──────┐   ┌──────────┐ ┌──────────┐
   │Allure│   │Slack/    │ │Dashboard │
   │Report│   │Email     │ │(Grafana) │
   └──────┘   └──────────┘ └──────────┘
   detail     notification  trends
```

**Tool đề xuất:**

| Tool | Mục đích |
|------|----------|
| **Allure Report** | Per-run detail report (screenshot, video, log) |
| **ReportPortal** | AI-assisted analysis, trend detection |
| **Grafana + InfluxDB** | KPI dashboard, historical trend |
| **Slack/Teams** | Real-time notification |

### 7.5. Required Report Contents

Mỗi test run report PHẢI có:

```yaml
test_run_report:
  metadata:
    run_id: uuid
    timestamp: ISO8601
    environment: staging
    git_commit: sha
    triggered_by: pull_request | schedule | manual
    
  summary:
    total: 250
    passed: 240
    failed: 5
    flaky: 3
    skipped: 2
    duration: 18m32s
    
  failures:
    - test_id: TC_LOGIN_001
      category: BUG
      severity: P0
      evidence:
        - screenshot.png
        - video.mp4
        - logs.txt
        - har.json
      rca: link_to_rca
      assigned_to: dev_team
      
  flaky_detection:
    - test_id: TC_PAYMENT_005
      pass_rate_last_30_runs: 70%
      trend: "declining"
      auto_quarantine: true  # tự đưa vào quarantine list
      
  trends:
    pass_rate_7d: 95.2%
    flaky_rate_7d: 2.8%
    avg_duration_7d: 19m
```

### 7.6. Notification Strategy

```yaml
notifications:
  on_pr_smoke_fail:
    channel: Slack #pr-failures
    mention: PR author
    include: failure summary, RCA link
    
  on_regression_fail:
    channel: Slack #qa-alerts
    mention: QA on-call
    include: full report link
    
  on_flaky_threshold:  # khi flaky rate > 5%
    channel: Slack #qa-leads
    include: top flaky tests, trend chart
    
  on_pass_rate_drop:   # pass rate < 90% trong 24h
    channel: Email QA lead
    include: regression report
    severity: P0
```

### 7.7. Test Analytics Dashboard

```
┌─────────────────────────────────────────────────┐
│           QA Dashboard (Grafana)                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Pass Rate Trend (30d)        Flaky Rate (30d) │
│  ┌────────────────────┐       ┌──────────────┐ │
│  │     ╱╲    ___      │       │   ╲╱╲        │ │
│  │ ___╱  ╲__╱   ╲___  │       │ __  ╲__      │ │
│  └────────────────────┘       └──────────────┘ │
│                                                 │
│  Top Flaky Tests              MTTR             │
│  1. TC_PAYMENT_005 (70%)      Bug: 4h          │
│  2. TC_LOGIN_023  (75%)       Flaky: 25min     │
│  3. TC_SEARCH_011 (80%)       Script: 15min    │
│                                                 │
│  Coverage                     Execution Time   │
│  Critical: 100%               Smoke: 6m        │
│  P1: 92%                      Regression: 22m  │
│  P2: 78%                      Nightly: 1h45m   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 7.8. Self-Healing (AI-assisted, Human-approved)

```yaml
self_healing_workflow:
  step_1_detect:
    - locator fail repeatedly (>3 runs)
    - element NotFoundError
    
  step_2_suggest:
    - AI analyze DOM/screenshot
    - propose alternative locators (top 3)
    - confidence score for each
    
  step_3_human_approve:
    - send PR with suggested fix
    - QA engineer review
    - approve / reject / modify
    
  step_4_apply:
    - merge approved PR
    - run regression to verify
    - update knowledge base
```

**KHÔNG BAO GIỜ:** Auto-apply locator fix vào main branch.

---

## 8. KPI & Metrics

### 8.1. Test Quality KPIs

| Metric | Target | Cách đo | Tần suất |
|--------|--------|---------|----------|
| **Pass rate (genuine)** | > 95% | `genuine_pass / total_runs` | Real-time |
| **Flaky rate** | < 3% | `intermittent_fail / total_runs` | Daily |
| **False positive rate** | < 1% | Manual spot-check 10% pass tests | Weekly |
| **False negative rate** | < 1% | Bug escaped to production / total bugs | Per release |
| **Critical flow coverage** | 100% | `automated_critical / total_critical` | Per sprint |
| **P1 flow coverage** | > 90% | `automated_P1 / total_P1` | Per sprint |

### 8.2. Operational KPIs

| Metric | Target | Cách đo |
|--------|--------|---------|
| **Mean Time to Detect (MTTD)** | < 30 min | Bug introduce → test fail |
| **Mean Time to Debug (MTTD)** | < 15 min | Test fail → có RCA |
| **Mean Time to Fix (MTTF)** | < 4h cho P0 | Test fail → fix merged |
| **Pipeline duration (PR)** | < 10 min | Smoke test trên PR |
| **Pipeline duration (regression)** | < 30 min | Full regression |

### 8.3. ROI Metrics

| Metric | Cách đo | Mục tiêu |
|--------|---------|----------|
| **Manual test hours saved** | (manual_hours_before − automation_run_time) × frequency | > maintenance hours |
| **Bug prevention rate** | Bugs caught by automation / total bugs found | > 70% |
| **Maintenance cost** | Hours fix flaky/update test per sprint | < 20% capacity |

### 8.4. Anti-KPIs (KHÔNG nên dùng)

| ❌ Anti-KPI | Vấn đề | Thay bằng |
|-------------|--------|-----------|
| "Số test case automated" | Khuyến khích viết bừa | Critical coverage % |
| "Pass rate 100%" | Khuyến khích skip test khó | Genuine pass rate |
| "Tốc độ chạy test" | Khuyến khích bỏ wait | Pipeline duration với SLA |

---

## 9. Anti-patterns cần tránh

### 9.1. Test Design Anti-patterns

| Anti-pattern | Hậu quả | Solution |
|--------------|---------|----------|
| Chỉ assert `isDisplayed()` | Miss regression về content | Assert content cụ thể |
| Chỉ check UI, không check API | False pass | Multi-layer assertion |
| Test phụ thuộc thứ tự | Fail dây chuyền | Independent test, isolation |
| Shared state giữa test | Flaky | beforeEach setup, afterEach cleanup |
| Quá nhiều E2E, ít API test | Slow + brittle | Test pyramid |

### 9.2. Implementation Anti-patterns

| Anti-pattern | Hậu quả | Solution |
|--------------|---------|----------|
| `browser.pause(3000)` | Flaky, slow | `waitUntil` với điều kiện |
| Hardcode locator/URL/credential | Không portable | Config file, env var |
| Page Object > 500 dòng | Khó maintain | Tách nhỏ theo screen/feature |
| Try-catch nuốt error | Mất evidence | Log error, fail test |
| Magic numbers | Khó hiểu | Named constants |

### 9.3. Execution Anti-patterns

| Anti-pattern | Hậu quả | Solution |
|--------------|---------|----------|
| Chạy parallel không isolate | Race condition, false fail | Account pool, data isolation |
| Không cleanup test data | Pass lần 1, fail lần 2 | afterEach cleanup |
| Retry mù quáng | Che giấu flaky | Retry có limit + log + alert |
| Skip test failing | Mất coverage | Quarantine + fix deadline |
| Không có nightly | Miss long-running issue | Nightly full regression |

### 9.4. Process Anti-patterns

| Anti-pattern | Hậu quả | Solution |
|--------------|---------|----------|
| Chỉ nhìn PASS/FAIL | Miss false pass | RCA cho mọi failure |
| Không phân loại failure | Route sai feedback | Failure classification tree |
| Auto-apply self-healing | Hide real bug | Human approve gate |
| Không có knowledge base | Lặp lại lỗi cũ | KB pattern + fix |
| QA report không actionable | Dev ignore | Include RCA + reproduction |

---

## 10. Tech Stack đề xuất

### 10.1. Core Stack

| Layer | Technology | Lý do |
|-------|-----------|-------|
| **Test runner** | WebdriverIO 8+ | Mature, plugin ecosystem rộng |
| **Language** | TypeScript 5+ | Type safety, refactor an toàn |
| **Mobile driver** | Appium 2 | Cross-platform iOS/Android |
| **Assertion** | Chai / Jest expect | Soft assertion support |
| **API client** | Axios + Zod | Type-safe API + schema validation |

### 10.2. Supporting Tools

| Purpose | Tool | Note |
|---------|------|------|
| Reporting | Allure Report | Best mobile test report |
| CI/CD | GitHub Actions / Jenkins | Tùy team |
| Device farm | BrowserStack / Sauce Labs | Real device testing |
| API mock | WireMock / MSW | Service virtualization |
| Visual regression | Applitools / Percy | Optional, cho UI critical |
| Contract test | Pact | API contract |
| Performance | Appium driver perfData | Built-in |
| Network sim | Charles Proxy / Toxiproxy | Network conditions |
| Linter | ESLint + Prettier | Code quality |
| Dashboard | Grafana + InfluxDB | KPI tracking |

### 10.3. Project Structure

```
mobile-automation/
├── .github/workflows/         # CI/CD pipelines
├── src/
│   ├── pages/                 # Page Objects
│   │   ├── LoginPage.ts
│   │   └── HomePage.ts
│   ├── tasks/                 # Screenplay tasks
│   ├── questions/             # Screenplay questions
│   ├── fixtures/              # Test data
│   │   ├── users.ts
│   │   └── products.ts
│   ├── factories/             # Dynamic data factories
│   ├── utils/
│   │   ├── wait.ts
│   │   ├── logger.ts
│   │   ├── apiClient.ts
│   │   └── assertion.ts
│   ├── contracts/             # Assertion Contracts (YAML)
│   ├── config/
│   │   ├── wdio.local.ts
│   │   ├── wdio.staging.ts
│   │   └── wdio.prod.ts
│   └── types/
├── tests/
│   ├── smoke/
│   ├── regression/
│   ├── negative/
│   └── nightly/
├── reports/                   # Generated, gitignored
├── docs/
│   ├── runbook.md
│   ├── flaky_kb.md           # Knowledge base
│   └── rca/                  # RCA archive
├── package.json
├── tsconfig.json
└── README.md
```

---

## 11. Implementation Roadmap

### Phase 1 — Foundation (Week 1-3)

**Goal:** Setup được hạ tầng cơ bản, chạy 1 smoke test e2e.

- [ ] Setup project structure + TypeScript + WDIO + Appium
- [ ] Setup local dev env (1 emulator iOS + 1 Android)
- [ ] Implement 1 smoke test (login flow) với Page Object
- [ ] Setup Allure reporting
- [ ] Document `runbook.md` cho team

**Done criteria:** Junior engineer pull repo, làm theo runbook, chạy được test trong 30 phút.

### Phase 2 — Validation Framework (Week 4-6)

**Goal:** Có Assertion Contract + multi-layer validation.

- [ ] Implement AssertionRunner + Contract format (YAML)
- [ ] Implement API client với schema validation
- [ ] Implement state checker (storage, DB)
- [ ] Convert smoke test sang dùng Contract
- [ ] Setup soft assertion

**Done criteria:** Test fail có thể chỉ ra fail ở UI / API / State layer nào.

### Phase 3 — Test Data & Environment (Week 7-9)

**Goal:** Test isolated, không flaky vì data.

- [ ] Implement UserFactory với cleanup
- [ ] Setup account pool service
- [ ] Setup environment matrix (.env.local, staging)
- [ ] Migrate existing test sang factory pattern
- [ ] Setup network simulation

**Done criteria:** Chạy 50 lần liên tục, không có data conflict.

### Phase 4 — CI/CD Integration (Week 10-12)

**Goal:** Test chạy tự động trên PR.

- [ ] Setup GitHub Actions với BrowserStack
- [ ] Implement parallelization (4 shards)
- [ ] Setup smoke test trên PR
- [ ] Setup nightly regression
- [ ] Setup Slack notification

**Done criteria:** PR mở → smoke chạy < 10 phút, fail block merge.

### Phase 5 — Observability & Intelligence (Week 13-16)

**Goal:** Có dashboard + auto-classification + knowledge base.

- [ ] Setup Grafana dashboard
- [ ] Implement failure auto-classification
- [ ] Implement flaky detection (auto-quarantine)
- [ ] Setup knowledge base
- [ ] Implement self-healing locator suggestion (AI-assisted)

**Done criteria:** Failure mới → auto-classify với confidence > 0.9, suggest fix.

### Phase 6 — Optimization & Scale (Week 17+)

**Goal:** Continuous improvement.

- [ ] Performance test integration
- [ ] Visual regression cho critical screen
- [ ] Cross-device matrix
- [ ] Contract testing với backend
- [ ] Test analytics (trend, prediction)

**Done criteria:** Đạt target KPI trong 8.

---

## 📌 Kết luận

Một hệ thống automation testing **trustworthy** không phải là code chạy được, mà là:

1. **Hiểu business** (Step 1)
2. **Design validation đúng** (Step 2 + Assertion Contract)
3. **Quản lý data/env chặt chẽ** (Step 3)
4. **Implement maintain được** (Step 4)
5. **Quan sát đầy đủ** (Step 5)
6. **Validate đa tầng** (Step 6)
7. **Phân tích đúng nguyên nhân** (Step 7 + Feedback Routing)
8. **Cải tiến liên tục** (Step 8)

→ Tất cả tạo thành **một vòng lặp orchestration có địa chỉ feedback rõ ràng**, kết hợp **automation thông minh** với **human judgment** ở các điểm quyết định.

> "Automation testing không phải là code chạy được,
> mà là **hệ thống ra quyết định dựa trên dữ liệu test**."

---

## 📚 Tài liệu tham khảo

- [Appium Documentation](https://appium.io/docs/en/latest/)
- [WebdriverIO Documentation](https://webdriver.io/docs/gettingstarted)
- [Test Pyramid — Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Page Object vs Screenplay — Serenity BDD](https://serenity-bdd.github.io/docs/screenplay/screenplay_fundamentals)
- [Pact — Contract Testing](https://docs.pact.io/)

---

*Document version 1.0 — Last updated: 2026-04-27*
