/**
 * Perf metric emitter — write `perf_run` datapoint vào InfluxDB.
 *
 * Spec ref: §7.5 (perf SLAs), M6 Task 1.
 * Plan ref: `docs/plans/M6-optimization.md` Task 1 — emit P95 metric.
 *
 * Design contract (parallel với InfluxEmitter):
 *   - Best-effort: HTTP fail KHÔNG throw → test KHÔNG bị poison khi
 *     observability infra down.
 *   - No-op khi env Influx chưa set (isEnabled = false).
 *   - Schema:
 *       measurement: perf_run
 *       tags: { test_id, flow, env, device, branch }
 *       fields: { p50_ms, p95_ms, max_ms, sample_count, threshold_ms,
 *                 within_sla (0|1) }
 *   - Caller chuẩn bị thống kê (qua `summarize()` từ computeP95.ts) rồi
 *     gọi `emitPerfRun(metric)`.
 */
import { logger } from '../logger';

export interface PerfRunMetric {
  testId: string;
  flow: 'login' | 'checkout' | 'search' | string;
  env: string;
  device: string;
  branch: string;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  sampleCount: number;
  thresholdMs: number;
  withinSla: boolean;
}

export interface PerfMetricEmitterConfig {
  url?: string;
  token?: string;
  org?: string;
  bucket?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function escapeTag(value: string): string {
  return value.replace(/([,= ])/g, '\\$1');
}

export function buildPerfRunLine(metric: PerfRunMetric, timestampNs?: bigint): string {
  const tags = [
    `test_id=${escapeTag(metric.testId)}`,
    `flow=${escapeTag(metric.flow)}`,
    `env=${escapeTag(metric.env)}`,
    `device=${escapeTag(metric.device)}`,
    `branch=${escapeTag(metric.branch)}`,
  ].join(',');

  const fields = [
    `p50_ms=${Math.max(0, Math.round(metric.p50Ms))}i`,
    `p95_ms=${Math.max(0, Math.round(metric.p95Ms))}i`,
    `max_ms=${Math.max(0, Math.round(metric.maxMs))}i`,
    `sample_count=${Math.max(0, Math.round(metric.sampleCount))}i`,
    `threshold_ms=${Math.max(0, Math.round(metric.thresholdMs))}i`,
    `within_sla=${metric.withinSla ? 1 : 0}i`,
  ].join(',');

  const ts = timestampNs ?? BigInt(Date.now()) * 1_000_000n;
  return `perf_run,${tags} ${fields} ${ts}`;
}

export class PerfMetricEmitter {
  private readonly url?: string;
  private readonly token?: string;
  private readonly org?: string;
  private readonly bucket?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PerfMetricEmitterConfig = {}) {
    this.url = config.url;
    this.token = config.token;
    this.org = config.org;
    this.bucket = config.bucket;
    this.timeoutMs = config.timeoutMs ?? 3000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  isEnabled(): boolean {
    return Boolean(this.url && this.token && this.org && this.bucket);
  }

  async emitPerfRun(metric: PerfRunMetric): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.debug('PerfMetricEmitter disabled (missing env) → skip emit', {
        testId: metric.testId,
      });
      return false;
    }

    const line = buildPerfRunLine(metric);
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
        logger.warn('PerfMetricEmitter write non-2xx → drop point', {
          testId: metric.testId,
          status: res.status,
          body: body.slice(0, 200),
        });
        return false;
      }
      return true;
    } catch (e) {
      logger.warn('PerfMetricEmitter write threw → drop point', {
        testId: metric.testId,
        error: (e as Error).message,
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createPerfMetricEmitterFromEnv(env: {
  INFLUX_URL?: string;
  INFLUX_TOKEN?: string;
  INFLUX_ORG?: string;
  INFLUX_BUCKET?: string;
}): PerfMetricEmitter {
  return new PerfMetricEmitter({
    url: env.INFLUX_URL,
    token: env.INFLUX_TOKEN,
    org: env.INFLUX_ORG,
    bucket: env.INFLUX_BUCKET,
  });
}
