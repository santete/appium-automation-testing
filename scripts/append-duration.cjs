#!/usr/bin/env node
/**
 * Pipeline duration tracker (M5 Task 8).
 *
 * Append 1 `pipeline_duration` line-protocol point vào InfluxDB sau khi 1
 * GH Actions workflow run xong. Grafana panel "Pipeline duration trend" trong
 * `infra/observability/grafana-dashboards/test-quality-overview.json` consume
 * data này.
 *
 * M4 carry-over (Decision 10 batch repay) — pipeline duration tracker là
 * follow-up của M4 D2 ("track pipeline minutes burn"), giờ wire qua InfluxDB
 * thay vì CSV-on-Gist.
 *
 * Inputs (env):
 *   INFLUX_URL          — required (vd: http://influxdb-host:8086)
 *   INFLUX_TOKEN        — required
 *   INFLUX_ORG          — required (default: mobile-automation)
 *   INFLUX_BUCKET       — required (default: test-runs)
 *   WORKFLOW            — required tag (vd: ci, regression, nightly)
 *   BRANCH              — required tag (default: GITHUB_REF_NAME hoặc main)
 *   DURATION_SECONDS    — required field value (integer)
 *   DRY_RUN             — '1' → log only, no HTTP call
 *
 * Exit codes:
 *   0 — success (point ingested OR dry-run OR Influx env missing → log + skip)
 *   1 — fatal (HTTP non-2xx, network throw, malformed env)
 *
 * Usage trong workflow:
 *   - name: Track pipeline duration
 *     if: always()
 *     env:
 *       INFLUX_URL: ${{ secrets.INFLUX_URL }}
 *       INFLUX_TOKEN: ${{ secrets.INFLUX_TOKEN }}
 *       INFLUX_ORG: mobile-automation
 *       INFLUX_BUCKET: test-runs
 *       WORKFLOW: ci
 *       BRANCH: ${{ github.ref_name }}
 *       DURATION_SECONDS: ${{ steps.timer.outputs.duration }}
 *     run: node scripts/append-duration.cjs
 */
const URL = process.env.INFLUX_URL;
const TOKEN = process.env.INFLUX_TOKEN;
const ORG = process.env.INFLUX_ORG || 'mobile-automation';
const BUCKET = process.env.INFLUX_BUCKET || 'test-runs';
const WORKFLOW = process.env.WORKFLOW;
const BRANCH = process.env.BRANCH || process.env.GITHUB_REF_NAME || 'unknown';
const DURATION = process.env.DURATION_SECONDS;
const DRY_RUN = process.env.DRY_RUN === '1';

function log(msg, ctx) {
  const ts = new Date().toISOString();
  const ctxStr = ctx ? ` ${JSON.stringify(ctx)}` : '';
  console.log(`[${ts}] [append-duration] ${msg}${ctxStr}`);
}

function fatal(msg) {
  log(`FATAL: ${msg}`);
  process.exit(1);
}

function escapeTag(value) {
  return String(value).replace(/([,= ])/g, '\\$1');
}

(async () => {
  if (!WORKFLOW) fatal('WORKFLOW env required');
  const seconds = parseInt(DURATION, 10);
  if (!Number.isFinite(seconds) || seconds < 0) {
    fatal(`DURATION_SECONDS invalid: ${DURATION}`);
  }

  if (!URL || !TOKEN) {
    log('Influx env missing → skip emit (dev local hoặc secrets chưa setup)', {
      hasUrl: !!URL,
      hasToken: !!TOKEN,
    });
    process.exit(0);
  }

  const tags = `workflow=${escapeTag(WORKFLOW)},branch=${escapeTag(BRANCH)}`;
  const fields = `duration_seconds=${seconds}i`;
  const tsNs = `${BigInt(Date.now()) * 1_000_000n}`;
  const line = `pipeline_duration,${tags} ${fields} ${tsNs}`;

  if (DRY_RUN) {
    log('DRY_RUN — line preview', { line });
    process.exit(0);
  }

  const writeUrl = `${URL}/api/v2/write?org=${encodeURIComponent(ORG)}&bucket=${encodeURIComponent(BUCKET)}&precision=ns`;
  try {
    const res = await fetch(writeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${TOKEN}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: line,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      fatal(`Influx write non-2xx: status=${res.status} body=${body.slice(0, 200)}`);
    }
    log('pipeline_duration ingested', { workflow: WORKFLOW, branch: BRANCH, seconds });
    process.exit(0);
  } catch (e) {
    fatal(`Influx write threw: ${e.message}`);
  }
})();
