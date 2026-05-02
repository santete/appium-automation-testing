/**
 * Percentile helpers cho perf test loops (M6 Task 1).
 *
 * Spec ref: §7.5 P95 SLA — login <2s, checkout <5s, search <1.5s.
 *
 * Design:
 *   - Spec runs N iterations of an action, records duration each iteration,
 *     then computes P95 trên đống durations đó.
 *   - Sort + nearest-rank method (NIST default): index = ceil(p * N) - 1.
 *     N=5, p=0.95 → index 4 (worst sample). Đây là pessimistic bound — phù
 *     hợp khi N nhỏ; khi N lớn (>=20) chuyển sang linear interpolation.
 *   - KHÔNG side effect: không log, không emit; caller decide.
 */

export function computePercentile(durations: readonly number[], percentile: number): number {
  if (durations.length === 0) {
    throw new Error('computePercentile: durations array is empty');
  }
  if (percentile <= 0 || percentile > 1) {
    throw new Error(`computePercentile: percentile must be in (0, 1], got ${percentile}`);
  }
  for (const d of durations) {
    if (!Number.isFinite(d) || d < 0) {
      throw new Error(`computePercentile: invalid duration ${d}`);
    }
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const rank = Math.ceil(percentile * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

export function computeP95(durations: readonly number[]): number {
  return computePercentile(durations, 0.95);
}

export function computeP50(durations: readonly number[]): number {
  return computePercentile(durations, 0.5);
}

export interface PerfStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
}

export function summarize(durations: readonly number[]): PerfStats {
  if (durations.length === 0) {
    throw new Error('summarize: durations array is empty');
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const d of durations) {
    if (d < min) min = d;
    if (d > max) max = d;
    sum += d;
  }
  return {
    count: durations.length,
    min,
    max,
    mean: sum / durations.length,
    p50: computeP50(durations),
    p95: computeP95(durations),
  };
}
