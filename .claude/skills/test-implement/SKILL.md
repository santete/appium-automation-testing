---
name: test-implement
description: Implement test code — Page Object, Screenplay, wait strategies, soft assertion, observability hooks. Dùng khi đã có Assertion Contract và cần viết TypeScript automation. Map vào Step 4-5 spec, enforce nghiêm các pattern bắt buộc (no pause, explicit wait, multi-layer).
---

# Test Implementation

Map vào **Step 4 (Implement)** + **Step 5 (Execute & Observe)** spec `automation_testing_requirement.md`.

## Khi invoke skill này

- Đã có Assertion Contract (output của skill `assertion-contract`).
- Đã có factory + env config (output của skill `test-data-setup`).
- User nói "implement / viết Page Object / spec / Screenplay cho ...".

**Không invoke khi chưa có contract** — skill này refuse implement test mà thiếu contract; redirect sang `assertion-contract` trước.

## Pattern bắt buộc (spec §3 step 4)

### a) Page Object

```typescript
// src/pages/LoginPage.ts
export class LoginPage {
  private readonly usernameInput = '~login_username_input';   // accessibility id
  private readonly passwordInput = '~login_password_input';
  private readonly submitButton  = '~login_submit_button';

  async login(username: string, password: string): Promise<void> {
    await $(this.usernameInput).setValue(username);
    await $(this.passwordInput).setValue(password);
    await $(this.submitButton).click();
  }
}
```

**Rules:**
- Locators private + readonly, dùng accessibility id (`~xxx`) không dùng XPath nếu có thể.
- Page Object < 500 dòng (spec §9.2). Tách theo screen/feature nếu vượt.
- KHÔNG assert trong Page Object — chỉ action + getter. Assert ở spec/contract layer.

### b) Wait strategy — KHÔNG `pause()` (spec §3 step 4c)

```typescript
// ❌ TUYỆT ĐỐI KHÔNG
await browser.pause(3000);

// ✅ Explicit wait với điều kiện và timeoutMsg
await browser.waitUntil(
  async () => await $(loginButton).isClickable(),
  { timeout: 10000, interval: 500, timeoutMsg: 'Login button not clickable after 10s' }
);
```

`timeoutMsg` BẮT BUỘC — không có thì debug thất bại không biết wait gì.

### c) Soft assertion (spec §3 step 4d)

```typescript
// Multi-layer assertion phải dùng soft để collect tất cả failure
expect.soft(ui.homeTitle).toBe('Home');
expect.soft(api.statusCode).toBe(200);
expect.soft(storage.token).toBeDefined();
```

Critical-severity assertions có thể dùng hard `expect`, còn high/medium dùng `expect.soft`.

### d) Run contract qua AssertionRunner

Implement test KHÔNG viết assertion ad-hoc — phải gọi runner đọc YAML contract:

```typescript
import { AssertionRunner } from '../utils/assertion';
import contract from '../contracts/AC_LOGIN_001.yaml';

it('TC_LOGIN_001 — valid credentials', async () => {
  await loginPage.login(user.username, user.password);

  const verdict = await new AssertionRunner().runContract(contract, {
    ui: await capturePageState(),
    api: await captureApiCalls(),
    state: await captureSecureStorage(),
  });

  expect(verdict.status).toBe('PASS');
});
```

### e) Observability hooks (spec §3 step 5)

Mỗi test phải tự động collect:
- Step logs (timestamp, action, element, result)
- Screenshot: on_fail BẮT BUỘC, before_critical_action BẮT BUỘC
- Video recording: bật trong CI/Nightly
- Network trace: HAR format
- Console/app log + crash report

Implement qua WDIO hooks (`beforeStep`, `afterStep`, `afterTest`) — không lặp code trong từng test.

## Code structure (spec §10.3)

Tạo file ở đúng vị trí:
- `src/pages/<Screen>Page.ts`
- `src/tasks/<Action>Task.ts` (Screenplay cho complex flow)
- `src/questions/<State>Question.ts`
- `src/utils/{wait,logger,apiClient,assertion}.ts`
- `tests/{smoke,regression,negative,nightly}/<feature>.spec.ts`

## Test isolation checklist (trước khi commit)

- [ ] Test có `beforeEach` setup data fresh (qua factory)
- [ ] Test có `afterEach` cleanup, idempotent
- [ ] Không có shared state với test khác (no global var, no shared `let`)
- [ ] Có thể chạy đơn lẻ (`--spec=this.ts`) và parallel
- [ ] Không có `pause()` hoặc magic timeout

## Anti-pattern (spec §9.2)

| Anti-pattern | Hậu quả | Fix |
|--------------|---------|-----|
| `browser.pause(3000)` | Flaky, slow | `waitUntil` |
| Hardcode locator/URL | Không portable | Config + accessibility id |
| Page Object > 500 dòng | Khó maintain | Tách theo screen |
| Try-catch nuốt error | Mất evidence | Log + re-throw |
| Magic numbers | Khó hiểu | Named constants |
| Assert trong Page Object | Mix concern | Assert ở spec layer |
| Test phụ thuộc thứ tự | Fail dây chuyền | Independent + isolated |
