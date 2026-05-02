# Runbook — M5 Acceptance Test (Phuc DN sign-off)

> Plan ref: `docs/plans/M5-observability.md` §2 done-criteria (sub-points 1-7).
> Mục tiêu: walk through 7 acceptance test một lần để confirm M5 🟢 trước
> khi merge vào main + chuyển roadmap sang M6.
>
> **Pre-req:**
> - Repo cloned + `npm ci` xong, Node 22.
> - Docker Desktop running (cho sub-point 2 dashboard).
> - GH CLI `gh` authenticated (cho sub-points 4 + 7).
> - `.env.local` đã có LLM key (chỉ cần cho sub-point 4 self-heal escalation —
>   verify-only debt: defer M6 closure nếu chưa fill).

---

## §1 Auto-classify accuracy ≥ 16/20 (80%, confidence ≥ 0.9)

**Verify cách 1 — automated test:**

```bash
npm run test:unit -- --grep "M5 acceptance"
```

Pass criteria:
- 5 specs pass, không skip.
- Console log `Total ≥ 0.9: 16/20` (xem confusion matrix trên stdout).
- `Confidence distribution` line cho mỗi case (C01-C20) match expectation
  trong `tests/fixtures/m5-classifier-corpus/corpus.json`.

**Verify cách 2 — confusion matrix human review:**

Đọc output `--- Confusion matrix ---` trong stdout, đảm bảo **diagonal**
chiếm dominant (expected = actual). Off-diagonal cell > 0 → rule nào đó
đang miss-classify, cần debug `src/utils/classifier/rules.ts` priority order.

**Acceptance:** ≥ 16/20 confidence ≥ 0.9 (rule-only baseline). Hiện tại đạt
**16/20 đúng cutoff.** 4 case còn lại (C17-C20) intentional design ở
confidence < 0.9 để demonstrate LLM escalator + UNKNOWN fallback path.

---

## §2 Dashboard trends live (6 KPI < 30s refresh)

```bash
# 1. Boot stack
docker compose -f infra/observability/docker-compose.yaml up -d

# 2. Wait healthcheck
docker compose -f infra/observability/docker-compose.yaml ps

# 3. Smoke ingest 1 datapoint (xem README.md infra/observability cho command đầy đủ)
curl -s -XPOST 'http://127.0.0.1:8086/api/v2/write?org=mobile-automation&bucket=test-runs&precision=s' \
  --header "Authorization: Token $INFLUX_ADMIN_TOKEN" \
  --header "Content-Type: text/plain; charset=utf-8" \
  --data-raw 'test_run,test_id=smoke,suite=test,env=local,device=stub,branch=main duration_ms=1000,status=1i' \
  -o /dev/null -w "%{http_code}"

# 4. Mở Grafana
xdg-open http://127.0.0.1:3000   # Linux
# Mac:   open http://127.0.0.1:3000
# Win:   start http://127.0.0.1:3000
```

Pass criteria:
- 6 KPI panel + bonus pipeline trend (= 7 total) hiển thị data.
- Pass rate panel: 100% (1/1 pass smoke point).
- Refresh interval ≤ 30s (default 30s đã set trong dashboard JSON).
- URL share-able local (chưa expose LAN — security note trong README).

**Cleanup:** `docker compose -f infra/observability/docker-compose.yaml down -v`.

---

## §3 KB auto-update từ classifier match

```bash
# Boot 1 inline test:
node -e '
const { appendKbEntry } = require("./dist/utils/kb/appender.js");
const c = {
  testId: "TC_DEMO_KB",
  category: "BUG",
  layer: "API",
  reproducible: true,
  reproductionRate: 1.0,
  routeTo: 1,
  assignTo: "dev_team",
  priority: "P0",
  rootCause: { description: "demo entry M5 acceptance", evidence: ["acceptance-runbook.md"] },
  confidence: 0.95,
  matchedRule: "bug:api-5xx"
};
appendKbEntry(c).then(r => console.log(r));
'
```

Pre-req: `npm run typecheck && npx tsc --outDir ./dist` để có `dist/` (KB
appender là TS — compile trước khi inline run).

Verify:
- `docs/flaky_kb.md` có entry `KB-YYYYMMDD-001 — demo entry M5 acceptance`.
- Run lại → output `{appended: false, reason: 'duplicate-24h'}` (dedup OK).
- Manual edit `Remediation:` section trong entry → re-run → manual content
  preserved (verify spec §6.5).

---

## §4 Self-healing PR open (KHÔNG auto-merge)

**Spike doc:** `docs/spikes/self-heal-locator.md` đã sign-off với 5 pass
criteria. Replay sub-point 4 trong runbook đó:

```bash
# Trigger workflow_dispatch
gh workflow run self-heal.yml \
  -f failingSelector='~test-Cart' \
  -f errorMessage='Element not found: ~test-Cart' \
  -f pageObjectFile='src/pages/CartPage.ts' \
  -f testId='TC_CART_001'

# Verify PR opened
gh pr list --label automation-self-heal
```

Pass criteria:
- 1 PR mở với title `[self-heal] ...`, body chứa top-3 alternatives + confidence.
- Branch protection block merge (verify GH UI: "Reviewers required").
- KHÔNG có auto-merge action.

**Note:** Verify-only debt theo Decision 10 — Phuc DN có thể defer M6 closure
nếu chưa fill `LLM_API_KEY`. Hiện tại UNIT TEST suggester với mocked adapter
(7 specs trong `tests/unit/self-heal.spec.ts`) đã verify logic.

---

## §5 Flaky auto-quarantine (30 run, 70% pass rate)

```bash
# Synthetic history với 30 record (~70% pass = 9 fail) cho 1 test
node -e '
const records = [];
const ids = ["TC_FLAKY_DEMO"];
for (let i = 0; i < 30; i++) {
  records.push({
    testId: ids[0],
    runId: "synth-" + i,
    status: i % 10 < 7 ? "pass" : "fail",
    timestamp: new Date(Date.now() - (29 - i) * 3600_000).toISOString()
  });
}
require("fs").writeFileSync("./tmp/test-history.json", JSON.stringify(records));
console.log("✓ written 30 records, expected fail count: 9");
'

# Run quarantine PR generator (DRY_RUN trước để inspect)
DRY_RUN=1 HISTORY_JSON_PATH=./tmp/test-history.json node scripts/auto-quarantine-pr.cjs
```

Pass criteria:
- DRY_RUN log show `TC_FLAKY_DEMO` tagged shouldQuarantine.
- Real run (skip DRY_RUN) → branch + PR mở với deadline today + 14d.
- M4 quarantine hook trên CI skip test khi merged (verify `npm run check:quarantine`).

---

## §6 CI report channel (Allure URL share-able)

```bash
# Trigger CI manually trên 1 PR draft hoặc:
gh workflow run publish-allure.yml

# Watch run
gh run watch
```

Pass criteria:
- `Publish Allure` workflow conclusion = success.
- URL `https://<user>.github.io/<repo>/` accessible KHÔNG cần GH login.
- `run-meta.json` có `publishedAt` ISO + `sourceWorkflow` đúng tên.
- Time từ workflow_run trigger → URL live: < 2 phút (acceptance §2 #6).

**Vercel fallback:** Nếu GH Pages bị org block, comment-out 3 GH Pages step
+ uncomment Vercel block trong `publish-allure.yml`. Cần secrets
`VERCEL_TOKEN/VERCEL_ORG_ID/VERCEL_PROJECT_ID`.

---

## §7 Notification fan-out

```bash
# Force 1 fail trên main (simulate):
gh workflow run ci.yml --ref main
# (Hoặc: revert 1 file để fail có chủ ý.)
```

Pass criteria:
- Sau khi CI trên `main` fail, < 5 phút có 1 GH Issue mở label
  `automation-fail`.
- Issue body chứa run URL + top-3 failure summary.
- Subsequent fail trong cùng day → comment append vào Issue cũ (không spam
  multiple issues).
- SMTP fallback: skip silently khi `SMTP_HOST` chưa set (xem step `if`
  trong `notify-fail.yml`).

---

## Closure checklist

- [ ] §1 ≥ 16/20 confidence ≥ 0.9 (M5 acceptance harness pass)
- [ ] §2 Grafana dashboard load + 6 KPI panel populated
- [ ] §3 KB entry append + dedup verified
- [ ] §4 Self-heal PR opened + branch protection block merge
- [ ] §5 Auto-quarantine PR opened với deadline + 14d
- [ ] §6 Allure URL live < 2 phút sau workflow done
- [ ] §7 GH Issue mở < 5 phút sau main fail
- [ ] Confusion matrix archived vào `docs/m5-acceptance-confusion-matrix.md`
      (paste output từ §1 stdout sau khi verify cuối)
- [ ] Plan doc `docs/plans/M5-observability.md` →
      Status 🟢 Done + closure section填 (date, verifier, debt log)
- [ ] ROADMAP.md M5 row → 🟢 Done + decisions log update
- [ ] Memory `MEMORY.md` không cần update (M5 không introduce surprising
      pattern khác với baseline)

**Total estimated walk-through time:** 60-90 phút (single dev, sequential).
