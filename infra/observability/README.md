# Observability stack — InfluxDB 2 + Grafana 10

> M5 Task 5 deliverable. Plan ref: `docs/plans/M5-observability.md` Decision 1+5.

## Boot

```bash
# 1. (Optional) override default tokens via env:
export INFLUX_ADMIN_TOKEN=$(openssl rand -hex 32)
export INFLUX_ADMIN_PASSWORD=$(openssl rand -base64 16)
export GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 16)

# 2. Boot stack:
docker compose -f infra/observability/docker-compose.yaml up -d

# 3. Verify:
#   - InfluxDB UI:   http://127.0.0.1:8086 (admin / $INFLUX_ADMIN_PASSWORD)
#   - Grafana UI:    http://127.0.0.1:3000 (anonymous Viewer; admin / $GRAFANA_ADMIN_PASSWORD for edit)
#   - Default dashboard: "Test Quality Overview (M5)" auto-loaded.

# 4. Wire into framework — set in .env.local:
INFLUX_URL=http://127.0.0.1:8086
INFLUX_TOKEN=<your INFLUX_ADMIN_TOKEN>
INFLUX_ORG=mobile-automation
INFLUX_BUCKET=test-runs
```

## Schema (data points)

| measurement | tags | fields |
|-------------|------|--------|
| `test_run` | `test_id`, `suite`, `env`, `device`, `branch` | `duration_ms`, `status` (0/1), `category` |
| `pipeline_duration` | `workflow`, `branch` | `duration_seconds` |
| `flaky_verdict` | `test_id` | `pass_rate`, `recent_fail_count`, `should_quarantine` (0/1) |
| `mttr` | `test_id` | `days` |
| `coverage` | `suite` | `line_pct`, `branch_pct` |

Metric emitter (M5 Task 6 — `src/utils/metrics/influxEmitter.ts`) writes
points qua HTTP `/api/v2/write` line-protocol.

## Panels (acceptance §2 sub-point 2 — 6 KPI)

1. **Pass rate (7d rolling)** — Stat panel, threshold 95% green / 85% yellow.
2. **Flaky rate (7d)** — Stat panel, threshold <5% green.
3. **MTTR** — Stat panel, days.
4. **Coverage (last run)** — Stat panel, threshold 85% green.
5. **Top-5 flaky tests** — Table panel, sorted by lowest pass rate.
6. **P95 execution time (7d)** — Stat panel, ms.

Bonus: `Pipeline duration trend` — timeseries 30d daily mean.

## Provisioning

- `grafana-provisioning/datasources/influxdb.yaml` — auto-create InfluxDB
  datasource (env var `INFLUX_TOKEN` injected từ docker-compose).
- `grafana-provisioning/dashboards/dashboards.yaml` — auto-load JSON từ
  `/var/lib/grafana/dashboards/`.
- `grafana-dashboards/test-quality-overview.json` — main dashboard.

Tất cả idempotent — boot lại stack thì datasource + dashboard auto re-provision.

## Security note

Hiện tại stack mặc định listen trên **127.0.0.1** only — KHÔNG expose ra LAN.
Anonymous viewer enabled trên Grafana (đọc public, không edit). Khi cần share
team trên cloud, M6 sẽ wire reverse proxy (nginx / caddy) + OAuth + remove
anonymous access.

## Smoke test

```bash
# Sau khi boot stack, test write line-protocol:
curl -i -XPOST 'http://127.0.0.1:8086/api/v2/write?org=mobile-automation&bucket=test-runs&precision=s' \
  --header "Authorization: Token $INFLUX_ADMIN_TOKEN" \
  --header "Content-Type: text/plain; charset=utf-8" \
  --data-raw 'test_run,test_id=smoke,suite=test,env=local,device=stub,branch=main duration_ms=1000,status=1 1735689600'

# Refresh Grafana dashboard — pass rate panel sẽ show 100% (1/1 pass).
```
