# Mobile Automation Testing Framework

[![CI](https://github.com/santete/appium-automation-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/santete/appium-automation-testing/actions/workflows/ci.yml)
[![Allure Report](https://img.shields.io/badge/allure-report-blue)](https://santete.github.io/appium-automation-testing/)

Mobile automation testing system theo nguyên tắc **trustworthy-by-design** (multi-layer assertion + addressed feedback routing + human-in-the-loop). Stack: WebdriverIO 8 + Appium 2 + TypeScript.

## Trạng thái

🟢 **M1 + M2 + M3 + M4 done; M5 plan ready 🔵** (Observability & Intelligence — chờ Phuc fill `.env` LLM_* để start Task 2+4).
Tiến độ chi tiết: [`ROADMAP.md`](ROADMAP.md).

## Quick start

1. Cài prerequisites + setup theo [`docs/runbook.md`](docs/runbook.md) (mất ~30 phút lần đầu).
2. Run smoke test: `npm run test:smoke`
3. View report: `npm run allure:open`

## Tài liệu

| File | Nội dung |
|------|----------|
| [`automation_testing_requirement.md`](automation_testing_requirement.md) | Spec gốc — triết lý, kiến trúc, 8-step workflow, KPI |
| [`CLAUDE.md`](CLAUDE.md) | Hướng dẫn cho AI assistant (Claude Code) làm việc trong repo |
| [`ROADMAP.md`](ROADMAP.md) | 6 milestones tracker + Debt log + Decisions log |
| [`docs/runbook.md`](docs/runbook.md) | Setup & run hướng dẫn |
| [`docs/plans/`](docs/plans/) | Implementation plan chi tiết per milestone |
| [`.claude/skills/`](.claude/skills/) | 7 skill cho Claude Code orchestrate workflow |

## Project structure

```
src/
├── config/        # WDIO config per environment
├── pages/         # Page Objects
├── utils/         # wait, logger, (M2: assertion runner, api client)
└── (M2+) contracts/, factories/, tasks/, questions/

tests/
├── smoke/         # Critical path — runs on PR (M4)
├── regression/    # Full coverage — runs on merge (M4)
├── negative/      # Error handling
└── nightly/       # Edge cases, perf

apps/              # .apk binaries (gitignored)
docs/              # runbook, plans, RCA archive (M5)
reports/           # generated, gitignored
```

## Common scripts

```bash
npm run test:smoke         # smoke suite (login)
npm run test:regression    # regression suite (purchase happy path)
npm run test:negative      # negative suite (invalid login: 2 cases)
npm run test:nightly       # nightly edge cases (empty checkout fields)
npm run test:smoke:20x     # 20x smoke runner (acceptance: data isolation + cleanup verify)
npm run test:unit          # 75 unit tests, ~1s
npm run test:integration   # 8 integration tests (+2 gated by ALLOW_NETWORK_INTEGRATION=1, +2 gated by RUN_REAL_DEVICE=1)
npm run test:api           # AC_API_DEMO_001 contract real httpbin.org
npm run lint               # ESLint — enforces no-pause rule + spec patterns
npm run typecheck          # TypeScript strict check
npm run check:quarantine   # validate docs/quarantine.yaml + deadline check
npm run build:test-apk     # build apps/state-test-debug.apk (D4 verify, requires JDK + Android SDK)
npm run format             # Prettier
npm run allure:open        # view last test report
```

## Merge gate (M4)

Mọi PR phải tick checklist trong [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md):
- **Auto (CI):** typecheck + lint + unit + integration + api PASS — block merge khi RED.
- **Honor system (manual):** `npm run test:smoke` PASS local trên dev device + paste evidence link. Reviewer enforce. M5+ wire device farm để auto-block.

## Đóng góp

Trước khi sửa code:
1. Đọc nguyên tắc bất biến trong [`CLAUDE.md`](CLAUDE.md) — đặc biệt no-pause, multi-layer assertion, plan-before-execute.
2. Check [`ROADMAP.md`](ROADMAP.md) xem thay đổi thuộc milestone nào, plan đã sign-off chưa.
3. Đọc [`docs/plans/_template.md`](docs/plans/_template.md) nếu start milestone mới.

<!-- M4 acceptance D5 verify 2026-05-02 -->
