---
name: test-data-setup
description: Setup test data factories, account pool, env matrix, network simulation. Dùng khi cần tạo dynamic data, isolation giữa tests, hoặc config environment. Map vào Step 3 + §4 spec — đây là step gây flaky nhiều nhất nên rất quan trọng.
---

# Test Data & Environment Setup

Map vào **Step 3** + **§4 Test Data & Environment Strategy** spec `automation_testing_requirement.md`.

> Spec §4 mở đầu: "Đây là step **bị bỏ qua nhiều nhất** và là **nguyên nhân #1 gây flaky test**."

## Khi invoke skill này

- Setup factory cho entity test (User, Order, ...).
- Setup account pool cho parallel runs.
- Cấu hình `.env.<env>` files / env matrix.
- Setup network simulation cho test resilience.
- User nói "setup test data / fixture / factory / pool".

## Nguyên tắc bất biến (KHÔNG VI PHẠM)

1. **Mỗi test có data riêng** — không shared state. Spec §4.2:
   ```typescript
   // ❌ WRONG
   const SHARED_USER = { id: 1, name: 'test' };

   // ✅ RIGHT
   beforeEach(async () => { testUser = await UserFactory.create(); });
   afterEach(async () => { await UserFactory.cleanup(testUser.id); });
   ```
2. **Cleanup BẤT KỂ pass/fail** — `afterEach` luôn chạy, không nằm trong try/catch của test.
3. **KHÔNG hardcode credential / URL / endpoint** — tất cả qua `process.env` + config layer.
4. **KHÔNG commit `.env` files** — chỉ commit `.env.example` với placeholder.

## Decision: data classification (spec §4.1)

| Loại | Khi dùng | Implement bằng |
|------|----------|----------------|
| **Static** | Lookup ổn định (country list, currency) | JSON/YAML trong `src/fixtures/` |
| **Dynamic** | Cần unique mỗi run (user account, order ID) | `src/factories/<Entity>Factory.ts` |
| **Generated** | Random cho stress/edge (random string, fake email) | Faker trong factory |

## Factory pattern bắt buộc

```typescript
// src/factories/UserFactory.ts
export class UserFactory {
  static async create(overrides?: Partial<User>): Promise<User> {
    // 1. Generate unique data (faker hoặc UUID)
    // 2. Seed vào DB / pool / API
    // 3. Return entity với id để cleanup tracking
  }

  static async cleanup(id: string): Promise<void> {
    // Xóa data, reset state, release resource
    // KHÔNG throw — cleanup phải idempotent
  }
}
```

## Account pool (cho parallel/CI runs)

Theo spec §4.3:
```yaml
test_account_pool:
  total: <N>
  states: [fresh, in_use, cooling, exhausted]
  allocation:
    - lock account before test
    - release after test (with state reset)
    - timeout: 30 min auto-release
    - rotation: round-robin tránh rate limit
```

Implement: pool service riêng (HTTP API hoặc in-memory cho local), KHÔNG ghi account credentials vào git.

## Environment matrix (spec §4.4)

Tạo `src/config/wdio.<env>.ts` cho mỗi env:

| Env | Purpose | Data | Devices |
|-----|---------|------|---------|
| local | Develop test mới | Local DB, mocks | 1 emulator |
| staging | CI/CD validation | Staging DB (refresh daily) | BrowserStack/Sauce |
| pre_prod | Final validation | Prod-like, anonymized | Real device farm |
| production | Smoke sau deploy | Sandbox, READ-ONLY | 1-2 real devices |

**Constraint production:** KHÔNG chạy test phá hoại — chỉ smoke read-only.

## Service mocking decision (spec §4.7)

| Real API | Mock |
|----------|------|
| E2E happy path | Error scenarios |
| Contract testing | Edge cases (rare) |
| Integration | Slow/unstable APIs, 3rd party (paid) |

Tool: WireMock / MSW / Mockoon.

## Network simulation (spec §4.6)

Setup được 4 condition: WiFi (good) / 3G (slow) / Offline / Flaky (packet loss). Tool: Charles Proxy hoặc Toxiproxy.

## Anti-pattern

- ❌ Shared `testUser` trong file scope.
- ❌ Cleanup trong `try/finally` của test code (nên ở `afterEach` hook).
- ❌ Hardcode `https://staging.app.com` trong test.
- ❌ Account pool không có timeout → crashed test giữ account vĩnh viễn.
- ❌ Production env có DELETE/POST mutate data.
