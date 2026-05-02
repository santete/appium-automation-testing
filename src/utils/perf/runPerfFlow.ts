/**
 * Generic perf spec helper — N iterations + P95 + Influx emit + contract assert.
 *
 * Spec ref: §7.5 P95 SLA, M6 Task 1.
 *
 * Caller cung cấp:
 *   - `actionFn(iteration)` — chạy 1 lần flow, return number ms.
 *     Caller chịu trách nhiệm reset state giữa các iteration (đăng xuất,
 *     terminate app, clearAppState, ...).
 *   - `flow` + `thresholdMs` — metadata cho metric emit + contract markers.
 *   - `iterations` (default 5) — N samples cho P95.
 *
 * Helper trả `PerfStats` + emit. Caller dùng stats.p95 set markers vào
 * InMemoryMarkerStore rồi gọi AssertionRunner trên contract tương ứng.
 *
 * Failure handling:
 *   - 1 iteration throw → toàn bộ spec fail (caller catch nếu cần custom RCA).
 *   - PerfMetricEmitter best-effort: emit fail KHÔNG throw.
 */
import { summarize, type PerfStats } from './computeP95';
import {
  PerfMetricEmitter,
  createPerfMetricEmitterFromEnv,
  type PerfRunMetric,
} from './perfMetricEmitter';
import { logger } from '../logger';

export interface RunPerfFlowOptions {
  flow: 'login' | 'checkout' | 'search' | string;
  testId: string;
  thresholdMs: number;
  iterations?: number;
  /** Run 1 iteration, return duration ms. */
  actionFn: (iteration: number) => Promise<number>;
  /** Optional emitter override (test injection). */
  emitter?: PerfMetricEmitter;
  /** Metadata cho Influx tags. */
  meta: { env: string; device: string; branch: string };
}

export interface RunPerfFlowResult {
  stats: PerfStats;
  withinSla: boolean;
}

export async function runPerfFlow(opts: RunPerfFlowOptions): Promise<RunPerfFlowResult> {
  const iterations = opts.iterations ?? 5;
  if (iterations < 1) {
    throw new Error(`runPerfFlow: iterations must be >= 1, got ${iterations}`);
  }

  const durations: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const ms = await opts.actionFn(i);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`runPerfFlow[${opts.flow}] iteration ${i}: invalid duration ${ms}`);
    }
    durations.push(ms);
    logger.info('perf iteration done', { flow: opts.flow, iteration: i, durationMs: ms });
  }

  const stats = summarize(durations);
  const withinSla = stats.p95 <= opts.thresholdMs;

  const emitter =
    opts.emitter ??
    createPerfMetricEmitterFromEnv({
      INFLUX_URL: process.env.INFLUX_URL,
      INFLUX_TOKEN: process.env.INFLUX_TOKEN,
      INFLUX_ORG: process.env.INFLUX_ORG,
      INFLUX_BUCKET: process.env.INFLUX_BUCKET,
    });
  const metric: PerfRunMetric = {
    testId: opts.testId,
    flow: opts.flow,
    env: opts.meta.env,
    device: opts.meta.device,
    branch: opts.meta.branch,
    p50Ms: stats.p50,
    p95Ms: stats.p95,
    maxMs: stats.max,
    sampleCount: stats.count,
    thresholdMs: opts.thresholdMs,
    withinSla,
  };
  await emitter.emitPerfRun(metric);

  logger.info('perf summary', {
    testId: opts.testId,
    flow: opts.flow,
    ...stats,
    thresholdMs: opts.thresholdMs,
    withinSla,
  });

  return { stats, withinSla };
}
