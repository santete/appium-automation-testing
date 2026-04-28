# Mobile Automation Testing Framework

Mobile automation testing system theo nguyên tắc **trustworthy-by-design** (multi-layer assertion + addressed feedback routing + human-in-the-loop). Stack: WebdriverIO 8 + Appium 2 + TypeScript.

## Trạng thái

🚧 **Đang xây dựng** — milestone hiện tại: M1 Foundation.
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
npm run test:smoke      # smoke suite
npm run test            # full suite (slow)
npm run lint            # ESLint — enforces no-pause rule + spec patterns
npm run typecheck       # TypeScript strict check
npm run format          # Prettier
npm run allure:open     # view last test report
```

## Đóng góp

Trước khi sửa code:
1. Đọc nguyên tắc bất biến trong [`CLAUDE.md`](CLAUDE.md) — đặc biệt no-pause, multi-layer assertion, plan-before-execute.
2. Check [`ROADMAP.md`](ROADMAP.md) xem thay đổi thuộc milestone nào, plan đã sign-off chưa.
3. Đọc [`docs/plans/_template.md`](docs/plans/_template.md) nếu start milestone mới.
