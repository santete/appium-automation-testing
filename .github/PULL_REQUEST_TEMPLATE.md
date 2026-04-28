<!--
PR template — M4 merge gate (xem docs/runbook-pr-merge-gate.md).

Tất cả checkbox bên dưới PHẢI tick trước khi reviewer approve.
CI gate (typecheck + lint + unit + integration + api) auto-block; smoke E2E
là honor-system gate vì M4 không wire device farm (Q2 sign-off 2026-04-28).
-->

## Summary

<!-- 1-3 bullets — what changed, why -->

## Milestone / Plan ref

<!-- Vd. M4 Task 5 — regression workflow. Link plan file nếu áp dụng. -->

- Plan: `docs/plans/MX-*.md` §
- ROADMAP impact: <!-- deliverable check / decision / debt change / none -->

## Multi-layer assertion check (spec §1.3, §6)

- [ ] Test mới có Assertion Contract YAML trong `src/contracts/` (nếu add UI/API/State coverage).
- [ ] Contract có ít nhất 2 layer (UI + API hoặc UI + State) — KHÔNG chỉ UI.
- [ ] Severity per check theo spec §5.3 (critical/high/medium/low).

## CI gate (auto)

- [ ] `npm run typecheck` PASS
- [ ] `npm run lint` PASS (no `pause()` / `sleep()` violation)
- [ ] `npm run test:unit` PASS
- [ ] `npm run test:integration` PASS
- [ ] `npm run test:api` PASS

> CI workflow `ci.yml` enforce trên PR. Nếu CI RED → fix trước khi xin review.

## Smoke E2E local verify gate (honor system — M4)

> Lý do: M4 không wire device farm (Q2 sign-off). Smoke E2E phải verify local trước khi merge.

- [ ] `npm run test:smoke` PASS local trên dev Android device/emulator
- [ ] Allure HTML attach hoặc paste link `reports/allure-report/index.html`
- [ ] Nếu skip vì PR thuần docs/CI/non-runtime → tick `[ ] N/A — docs-only PR` và justify ở Summary

**Evidence link:** <!-- screenshot, gist, hoặc reports/allure-* path -->

## Quarantine list

- [ ] Không thêm test mới vào `docs/quarantine.yaml` (nếu thêm → phải có deadline ≤ 2 tuần + owner)
- [ ] Quarantine entry past-deadline → đã fix hoặc extend grace ≤ 1 tuần (PR review)

## Plan-before-execute (CLAUDE.md)

- [ ] Nếu start milestone mới → plan file đã sign-off (status 🔵)
- [ ] Decisions log cập nhật trong ROADMAP nếu có quyết định technical mới
- [ ] Debt log cập nhật nếu accept shortcut tạm thời

## Test plan

<!-- Bulleted markdown checklist for reviewer reproduce verify -->
