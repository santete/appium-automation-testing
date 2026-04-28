# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

**This is a specification-only repository.** The single file is `automation_testing_requirement.md` — a v1.0 requirement document (in Vietnamese) for a mobile automation testing system. There is no source code, `package.json`, build tooling, tests, or CI config yet. Do not invent build/lint/test commands; none exist. When the user asks to implement, follow the planned tech stack and structure below.

## Planned tech stack (from spec §10)

- **Test runner:** WebdriverIO 8+
- **Language:** TypeScript 5+
- **Mobile driver:** Appium 2 (cross-platform iOS/Android)
- **Assertion:** Chai / Jest expect with **soft assertion** support
- **API client:** Axios + Zod (schema validation)
- **Reporting:** Allure Report
- **Device farm:** BrowserStack / Sauce Labs
- **API mock:** WireMock / MSW
- **Contract test:** Pact
- **CI/CD:** GitHub Actions (with sharded parallel execution)

## Planned project structure (from spec §10.3)

```
src/
├── pages/        # Page Objects
├── tasks/        # Screenplay tasks (for complex flows)
├── questions/    # Screenplay questions
├── fixtures/     # Static test data
├── factories/    # Dynamic data factories (UserFactory, etc.)
├── utils/        # wait, logger, apiClient, assertion runner
├── contracts/    # Assertion Contracts (YAML)
├── config/       # wdio.local.ts / wdio.staging.ts / wdio.prod.ts
└── types/
tests/
├── smoke/        # Critical path, runs on every PR
├── regression/   # Full coverage, runs on merge to main
├── negative/     # Invalid input / error handling
└── nightly/      # Edge cases, performance, visual regression
```

## Core architectural principles (non-negotiable from spec §1, §5, §6)

These are the load-bearing decisions. Implementation work must respect them — they are not suggestions:

1. **PASS ≠ Correct.** Every test must validate **multiple layers** (UI + API + State). UI-only assertion is a false-pass trap. See spec §6 Validation Decision Matrix.
2. **Assertion Contract is designed at Step 2, not Step 4.** Each test case must have a YAML `Assertion Contract` (spec §5.2) defining positive, negative, performance, and optionally visual assertions across UI/API/State layers, each with severity (critical/high/medium/low).
3. **No `browser.pause()` / `sleep()`.** Use `browser.waitUntil(...)` with explicit conditions and timeout messages. This is enforced — flaky-by-sleep is a known anti-pattern (§9.2).
4. **Test isolation is mandatory.** Each test gets fresh data via factories in `beforeEach`, cleaned up in `afterEach` regardless of pass/fail. No shared state between tests. Account pool with lock/release/timeout for parallel runs.
5. **Failures must self-route.** Every failure carries `FailureMetadata` (category, layer, reproducible, rootCause, routeTo step 1-8) so feedback goes to the correct workflow step — see spec §6 routing decision table.
6. **Self-healing locators are AI-suggested, human-approved.** Never auto-apply locator fixes to main. Suggested fixes ship as PRs for human review (§7.8, §9.4).
7. **Soft assertion for non-critical layers** so a single run reports all failures, not just the first.
8. **Human-in-the-loop at decision points.** Auto-classify, but humans approve fixes — especially for self-healing.

## Workflow model (spec §2-3)

The system implements an 8-step orchestrated loop with **addressed feedback** — when a test fails, it routes to a *specific* step, not "back to the start":

```
1. Requirement Analysis    → testable scenarios + acceptance criteria
2. Test Strategy & Design  → Assertion Contract (the deliverable)
3. Test Data & Env Setup   → factories, account pool, env matrix
4. Implement Automation    → Page Objects / Screenplay
5. Execute & Observe       → logs, screenshots, video, HAR, device metrics
6. Validate Result         → multi-layer verdict (genuine pass vs false pass)
7. Analyze & Debug         → RCA + classification
8. Improve & Stabilize     → reactive (stabilize) + proactive (evolution)
```

Failure routing (spec §6.2): API 500 → step 1 (req) or dev; flaky → step 5; CI-only fail → step 3 (env); wrong assertion → step 2 (contract); locator wrong → step 4.

## Test pyramid for mobile (§2.2, §3 step 2)

Target ratio: **~10% E2E UI (Appium)**, **~30% API integration**, **~60% unit/component (dev-owned)**. E2E is reserved for critical flows only — login, payment, checkout. Resist requests to add UI E2E tests for non-critical paths; push them down the pyramid.

## What "done" means for a test

Per the Trustworthiness Pyramid (§1.2), a test is an asset only if it is **Reliable + Meaningful + Maintainable + Traceable**. Missing any of these makes it technical debt. When implementing or reviewing tests, check all four — not just "does it pass."

## Implementation roadmap & plan-before-execute rule

**Tracker:** `ROADMAP.md` (root) — 6 milestones M1-M6 với status, deliverables, done criteria, decisions log. Map 1-1 với spec §11 Phase 1-6.

**Quy tắc bất biến:** KHÔNG implement bất kỳ milestone nào khi chưa có `docs/plans/MX-<name>.md` được sign-off. Plan dùng template `docs/plans/_template.md`. Workflow đầy đủ ở `docs/plans/README.md`.

Khi user nói "start MX" hoặc "implement Phase Y":
1. Check `ROADMAP.md` xem milestone đó status gì.
2. Nếu ⬜/📝 → tạo plan từ template, fill các "Plan checklist" trong ROADMAP, hỏi stakeholder confirm các technical decisions trước khi viết code.
3. Chỉ chuyển sang execute khi status = 🔵 (plan signed-off).
4. Update task checkboxes + weekly status trong khi execute.
5. Validate done criteria → mark 🟢 + update Decisions log.

Khi user hỏi "next steps?" hoặc "what's left?", reference ROADMAP.md status hiện tại, KHÔNG improvise.

## Project skills (`.claude/skills/`)

7 skill được định nghĩa, mỗi skill map vào 1 step trong workflow + cross-cutting framework. Auto-discovered bởi Claude Code:

| Skill | Map vào spec | Khi invoke |
|-------|--------------|------------|
| `test-requirement` | Step 1 | Phân tích PRD → Test Scenario YAML + testability assessment |
| `assertion-contract` | Step 2 + §5 | Design Assertion Contract YAML (multi-layer + severity) trước khi implement |
| `test-data-setup` | Step 3 + §4 | Setup factory, account pool, env matrix, network sim |
| `test-implement` | Step 4-5 | Viết Page Object / Screenplay / spec + observability hooks (refuse nếu chưa có contract) |
| `test-validate` | Step 6 | Validate result đa tầng → verdict GENUINE_PASS / FALSE_PASS / FLAKY / BUG |
| `failure-rca` | Step 7 + §6 | RCA + classification + routing feedback về đúng step + update KB |
| `test-review` | §1.2 + §9 | Review test theo Trustworthiness Pyramid + scan anti-pattern (block-merge rule) |

Skills cross-reference nhau (vd. `test-validate` route sang `failure-rca` khi verdict ≠ GENUINE_PASS) và đều đọc lại spec gốc khi cần — không duplicate nội dung spec.

## Notes for working in this repo

- The spec is in **Vietnamese** with technical terms in English. Preserve this language style if editing the spec; new code/comments default to English.
- Today's date in spec context: 2026-04-27 (matches spec footer).
- When implementation begins, the first concrete deliverables per Phase 1 are: TypeScript + WDIO + Appium scaffold, one login smoke test using Page Object, Allure reporting, and a `docs/runbook.md`.
