# BRD — `<Feature name>` — `<YYYY-MM-DD>`

> Template — copy file này thành `docs/requirements/BRD-<feature-slug>-<YYYY-MM-DD>.md`
> mỗi khi PM/BA gửi business requirement mới cho mobile feature.
>
> **Mục đích:** snapshot BRD tại thời điểm QA bắt đầu phân tích →
> traceability từ scenario YAML / contract YAML / spec ngược về requirement gốc.
>
> **Source of truth** vẫn là PM tool (Jira/Linear/Notion link). Markdown này
> là **immutable snapshot** — không update sau khi commit. Nếu requirement
> change → tạo BRD mới với suffix `-v2`, `-v3`.

---

## Metadata

| Field           | Value                                                  |
|-----------------|--------------------------------------------------------|
| Feature ID      | `FEAT-<NNN>` (Jira / Linear ticket)                    |
| Feature name    | `<Apply discount coupon at checkout>`                  |
| Author (PM/BA)  | `<name>`                                               |
| QA owner        | `<name>` (= người tạo scenario YAML từ BRD này)        |
| Source link     | `<Jira / Linear / Notion URL>`                         |
| Snapshot date   | `<YYYY-MM-DD>`                                         |
| BRD version     | `v1` \| `v2` (nếu requirement đã change)               |
| Status          | DRAFT \| READY_FOR_QA \| IN_TEST \| SHIPPED \| DEPRECATED |
| Target release  | `<v1.2.3 hoặc sprint XX>`                              |
| Platform scope  | Android only \| iOS only \| Both                       |

## 1. Business goal

<1-2 câu plain English — vì sao build feature này, value cho user/business>

Vd: "Tăng conversion rate ở checkout step bằng cách cho phép user apply
discount code → giảm cart abandonment, đo qua metric `checkout_complete_rate`."

## 2. User story (PM viết — không phải acceptance criteria)

```
As a <persona>
I want <action>
So that <benefit>
```

Vd:
```
As a returning customer
I want to apply a discount coupon at checkout
So that I can use promotional codes received via email
```

## 3. Functional requirements

> Liệt kê WHAT phải làm — không liệt kê HOW (đó là dev's job).

- FR-1: User nhập coupon code ở checkout screen.
- FR-2: System validate code → apply discount nếu hợp lệ.
- FR-3: Display updated total trên UI ngay lập tức.
- FR-4: Support 3 loại coupon: percentage off, fixed amount off, free shipping.
- FR-5: ...

## 4. Non-functional requirements

- **Performance:** apply coupon response < 1.5s (P95).
- **Reliability:** support offline mode? (Yes — queue retry / No — block until online)
- **Security:** rate limit attempts? (5 attempts / 15 phút / IP)
- **Accessibility:** screen reader compatible? (yes — VoiceOver + TalkBack)

## 5. UI mockups / specs

- Figma link: `<URL>`
- Screen 1: Checkout (coupon input field + apply button)
- Screen 2: Success state (line item discount + new total)
- Screen 3: Error states (invalid / expired / max usage exceeded / network)

## 6. API contract (nếu có spec sẵn từ backend)

```yaml
# POST /api/v2/cart/apply-coupon
request:
  cart_id: string (uuid)
  code: string (10-20 char, alphanum + dash)
response_200:
  cart_id: string
  discount_code: string
  discount_amount_cents: integer
  new_total_cents: integer
  applied_at: ISO8601 timestamp
response_400:
  error_code: enum(INVALID_CODE, EXPIRED, MAX_USAGE_EXCEEDED, MIN_CART_NOT_MET)
  user_message: string (i18n key)
```

## 7. Edge cases & error states (PM phải nghĩ trước)

- Empty code submit → block button (không call API).
- Code chứa special char `<>` → escape, không reject upfront (server validate).
- Apply 2 lần code khác nhau → code thứ 2 replace code thứ 1.
- Cart total < min order amount → error `MIN_CART_NOT_MET`.
- Network drop giữa apply → user thấy loading, retry 3 lần rồi error.
- Code đã apply ở cart cũ + tạo cart mới → cart mới không tự inherit.

## 8. Out of scope (KHÔNG làm trong release này)

- Stack multiple coupon (chỉ 1 code/cart).
- Coupon for specific SKU (chỉ cart-level).
- Coupon trả về store credit thay vì discount immediate.

## 9. Open questions / clarification needed

> PM tự nhận diện ambiguity TRƯỚC khi gửi BRD cho QA. Nếu không biết —
> để empty + flag `Status=DRAFT`. QA sẽ thêm vào khi phân tích.

- [ ] Q1: Coupon expired đúng giờ phút giây hay theo timezone của user?
- [ ] Q2: Hiển thị coupon đã dùng trong order history?
- [ ] Q3: Refund order — coupon có được restore không?

## 10. Acceptance criteria (PM định nghĩa — không phải test case)

> Khác testcase ở chỗ: AC là **business outcome**, testcase là **how to verify outcome**.

- AC-1: User apply hợp lệ → discount line item hiển thị + total reduce
  đúng số tiền theo coupon type.
- AC-2: User apply invalid → error message hiển thị inline (không toast),
  total không thay đổi.
- AC-3: Apply thành công persist khi user navigate cart → checkout → cart.
- AC-4: 95% apply request hoàn thành < 1.5s.

## 11. References

- Source ticket: `<URL>`
- Design doc (dev side): `<URL>`
- API doc (backend side): `<URL>`
- Related BRD (nếu có dependency): `<file path>`

---

## Workflow ownership

| Step | Owner | Output |
|------|-------|--------|
| 1. Viết BRD | PM/BA | File này |
| 2. Snapshot vào repo | QA | `git commit` |
| 3. Phân tích → scenario | QA (qua `/test-requirement`) | `tests/scenarios/<feature>.scenario.yaml` |
| 4. Clarify ambiguity | QA ↔ PM | Update §9 + scenario YAML `clarify_needed` |
| 5. Design contract | QA (qua `/assertion-contract`) | `src/contracts/AC_<TC_ID>.yaml` |
| 6. Implement spec | QA (qua `/test-implement`) | `tests/<suite>/<feature>.spec.ts` |
| 7. Status = SHIPPED | PM + QA | Update field §Metadata.Status |

---

## Notes

- BRD này là snapshot — KHÔNG edit sau khi commit. Update bằng cách tạo
  file mới `BRD-<slug>-<date>-v2.md`.
- Nếu PM viết BRD trực tiếp trong Jira → QA copy nội dung relevant vào
  file này. Không yêu cầu PM dùng markdown.
- Confidential info (pricing strategy, business rule không công khai) →
  cân nhắc commit private repo hoặc redact section trước khi commit.
