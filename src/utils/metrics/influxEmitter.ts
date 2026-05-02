/**
 * InfluxDB 2 metric emitter — write line-protocol qua HTTP `/api/v2/write`.
 *
 * M5 Task 6 deliverable. Plan ref: `docs/plans/M5-observability.md` Decision 1
 * (Grafana + InfluxDB self-host) + schema trong `infra/observability/influxdb-init.flux`.
 *
 * Design contract:
 *  - Emitter là **best-effort**: write fail KHÔNG throw → test không bị poison
 *    bởi observability infra down. Caller (afterTest hook) gọi safe.
 *  - Network call wrapped trong timeout (default 3s) để không hang test.
 *  - Khi env `INFLUX_URL/TOKEN/ORG/BUCKET` chưa set → emitter no-op (log debug),
 *    KHÔNG throw — dev local muốn skip dashboard có thể bỏ trống env.
 *  - Line-protocol escape: tag + field key/value escape spaces, commas, equals.
 *
 * Schema (xem `infra/observability/influxdb-init.flux`):
 *   measurement: test_run
 *   tags: { test_id, suite, env, device, branch }
 *   fields: { duration_ms, status (0|1), category? (string label) }
 */
import { logger } from '../logger';

export interface TestRunMetric {
  testId: string;
  suite: string;
  env: string;
  device: string;
  branch: string;
  durationMs: number;
  status: 'pass' | 'fail';
  category?: string;
}

export interface InfluxEmitterConfig {
  url?: string;
  token?: string;
  org?: string;
  bucket?: string;
  /** Timeout ms cho HTTP write — default 3000. */
  timeoutMs?: number;
  /** Fetch impl — inject để test, default global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Escape string cho line-protocol tag key/value + field key.
 * Xem: https://docs.influxdata.com/influxdb/v2/reference/syntax/line-protocol/#special-characters
 */
function escapeTag(value: string): string {
  return value.replace(/([,= ])/g, '\\$1');
}

/** Escape string cho field value (chỉ escape `"` và `\`). */
function escapeStringField(value: string): string {
  return value.replace(/(["\\])/g, '\\$1');
}

/**
 * Build line-protocol cho 1 test_run datapoint.
 *
 * Format: `measurement,tagk=tagv field=val [timestamp_ns]`
 *
 * Status: pass → 1, fail → 0. Đây là field numeric (không phải tag) để
 * Grafana mean() ra pass-rate.
 */
export function buildTestRunLine(metric: TestRunMetric, timestampNs?: bigint): string {
  const tags = [
    `test_id=${escapeTag(metric.testId)}`,
    `suite=${escapeTag(metric.suite)}`,
    `env=${escapeTag(metric.env)}`,
    `device=${escapeTag(metric.device)}`,
    `branch=${escapeTag(metric.branch)}`,
  ].join(',');

  const fields: string[] = [
    `duration_ms=${Math.max(0, Math.round(metric.durationMs))}i`,
    `status=${metric.status === 'pass' ? 1 : 0}i`,
  ];
  if (metric.category) {
    fields.push(`category="${escapeStringField(metric.category)}"`);
  }

  const ts = timestampNs ?? BigInt(Date.now()) * 1_000_000n;
  return `test_run,${tags} ${fields.join(',')} ${ts}`;
}

export class InfluxEmitter {
  private readonly url?: string;
  private readonly token?: string;
  private readonly org?: string;
  private readonly bucket?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: InfluxEmitterConfig = {}) {
    this.url = config.url;
    this.token = config.token;
    this.org = config.org;
    this.bucket = config.bucket;
    this.timeoutMs = config.timeoutMs ?? 3000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** True khi tất cả env required có giá trị → enabled. */
  isEnabled(): boolean {
    return Boolean(this.url && this.token && this.org && this.bucket);
  }

  /**
   * Write 1 test_run point. Best-effort: error → log + return false.
   * Trả `true` nếu HTTP 2xx, `false` nếu disabled / network fail / non-2xx.
   */
  async emitTestRun(metric: TestRunMetric): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.debug('InfluxEmitter disabled (missing env) → skip emit', { testId: metric.testId });
      return false;
    }

    const line = buildTestRunLine(metric);
    const writeUrl = `${this.url}/api/v2/write?org=${encodeURIComponent(this.org!)}&bucket=${encodeURIComponent(this.bucket!)}&precision=ns`;

    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(writeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.token}`,
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: line,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.warn('InfluxEmitter write non-2xx → drop point', {
          testId: metric.testId,
          status: res.status,
          body: body.slice(0, 200),
        });
        return false;
      }
      return true;
    } catch (e) {
      logger.warn('InfluxEmitter write threw → drop point', {
        testId: metric.testId,
        error: (e as Error).message,
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Factory đọc env trực tiếp — convenience cho WDIO hook. */
export function createInfluxEmitterFromEnv(env: {
  INFLUX_URL?: string;
  INFLUX_TOKEN?: string;
  INFLUX_ORG?: string;
  INFLUX_BUCKET?: string;
}): InfluxEmitter {
  return new InfluxEmitter({
    url: env.INFLUX_URL,
    token: env.INFLUX_TOKEN,
    org: env.INFLUX_ORG,
    bucket: env.INFLUX_BUCKET,
  });
}
