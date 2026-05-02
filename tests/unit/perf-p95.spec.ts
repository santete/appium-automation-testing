/**
 * Unit tests cho perf utilities (M6 Task 1).
 *
 * Cover:
 *  - computePercentile: nearest-rank correctness, edge (single sample,
 *    sorted/unsorted input, p=1.0), reject empty + invalid percentile
 *    + invalid duration.
 *  - computeP95 / computeP50: alias correctness.
 *  - summarize: count/min/max/mean/p50/p95 đồng nhất với manual.
 *  - PerfMetricEmitter.buildPerfRunLine: tag escape, withinSla 1/0,
 *    rounding float.
 *  - PerfMetricEmitter.isEnabled() + emitPerfRun (success / non-2xx /
 *    throw / disabled).
 *  - createPerfMetricEmitterFromEnv.
 *  - runPerfFlow: collects N durations, computes stats, emits metric,
 *    returns withinSla khi p95 ≤ threshold.
 */
import { expect } from 'chai';
import {
  computePercentile,
  computeP95,
  computeP50,
  summarize,
} from '../../src/utils/perf/computeP95';
import {
  PerfMetricEmitter,
  buildPerfRunLine,
  createPerfMetricEmitterFromEnv,
  type PerfRunMetric,
} from '../../src/utils/perf/perfMetricEmitter';
import { runPerfFlow } from '../../src/utils/perf/runPerfFlow';

const BASE_PERF: PerfRunMetric = {
  testId: 'TC_PERF_LOGIN_001',
  flow: 'login',
  env: 'local',
  device: 'pixel-7',
  branch: 'main',
  p50Ms: 800,
  p95Ms: 1900,
  maxMs: 1950,
  sampleCount: 5,
  thresholdMs: 2000,
  withinSla: true,
};

function makeMockFetch(status: number): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('computePercentile', () => {
  it('returns sample at nearest-rank index', () => {
    const samples = [10, 20, 30, 40, 50];
    expect(computePercentile(samples, 0.95)).to.equal(50); // ceil(0.95*5)=5 → idx 4
    expect(computePercentile(samples, 0.5)).to.equal(30);
    expect(computePercentile(samples, 0.2)).to.equal(10);
  });

  it('handles unsorted input', () => {
    expect(computePercentile([50, 10, 30, 40, 20], 0.95)).to.equal(50);
    expect(computePercentile([50, 10, 30, 40, 20], 0.5)).to.equal(30);
  });

  it('handles single sample', () => {
    expect(computePercentile([42], 0.95)).to.equal(42);
    expect(computePercentile([42], 0.5)).to.equal(42);
  });

  it('handles p=1.0 → max', () => {
    expect(computePercentile([1, 2, 3], 1.0)).to.equal(3);
  });

  it('throws on empty array', () => {
    expect(() => computePercentile([], 0.95)).to.throw(/empty/);
  });

  it('throws on invalid percentile', () => {
    expect(() => computePercentile([1, 2], 0)).to.throw(/percentile/);
    expect(() => computePercentile([1, 2], 1.5)).to.throw(/percentile/);
    expect(() => computePercentile([1, 2], -0.1)).to.throw(/percentile/);
  });

  it('throws on invalid duration', () => {
    expect(() => computePercentile([1, NaN, 3], 0.95)).to.throw(/invalid duration/);
    expect(() => computePercentile([1, -5, 3], 0.95)).to.throw(/invalid duration/);
    expect(() => computePercentile([1, Infinity, 3], 0.95)).to.throw(/invalid duration/);
  });
});

describe('computeP95 / computeP50', () => {
  it('aliases work correctly', () => {
    const samples = [100, 200, 300, 400, 500];
    expect(computeP95(samples)).to.equal(500);
    expect(computeP50(samples)).to.equal(300);
  });
});

describe('summarize', () => {
  it('returns count/min/max/mean/p50/p95', () => {
    const stats = summarize([100, 200, 300, 400, 500]);
    expect(stats.count).to.equal(5);
    expect(stats.min).to.equal(100);
    expect(stats.max).to.equal(500);
    expect(stats.mean).to.equal(300);
    expect(stats.p50).to.equal(300);
    expect(stats.p95).to.equal(500);
  });

  it('throws on empty array', () => {
    expect(() => summarize([])).to.throw(/empty/);
  });
});

describe('buildPerfRunLine', () => {
  it('builds line-protocol with tags + fields + ns timestamp', () => {
    const line = buildPerfRunLine(BASE_PERF, 1700000000000000000n);
    expect(line).to.include('perf_run,');
    expect(line).to.include('test_id=TC_PERF_LOGIN_001');
    expect(line).to.include('flow=login');
    expect(line).to.include('env=local');
    expect(line).to.include('device=pixel-7');
    expect(line).to.include('branch=main');
    expect(line).to.include('p50_ms=800i');
    expect(line).to.include('p95_ms=1900i');
    expect(line).to.include('max_ms=1950i');
    expect(line).to.include('sample_count=5i');
    expect(line).to.include('threshold_ms=2000i');
    expect(line).to.include('within_sla=1i');
    expect(line).to.match(/ 1700000000000000000$/);
  });

  it('escapes spaces/commas/equals in tag values', () => {
    const line = buildPerfRunLine({ ...BASE_PERF, device: 'pixel 6, gen=2' });
    expect(line).to.include('device=pixel\\ 6\\,\\ gen\\=2');
  });

  it('encodes withinSla=false as 0i', () => {
    const line = buildPerfRunLine({ ...BASE_PERF, withinSla: false });
    expect(line).to.include('within_sla=0i');
  });

  it('rounds float p95 to int', () => {
    const line = buildPerfRunLine({ ...BASE_PERF, p95Ms: 1899.7 });
    expect(line).to.include('p95_ms=1900i');
  });

  it('clamps negative duration to 0', () => {
    const line = buildPerfRunLine({ ...BASE_PERF, p95Ms: -50 });
    expect(line).to.include('p95_ms=0i');
  });
});

describe('PerfMetricEmitter', () => {
  it('isEnabled() requires all 4 env fields', () => {
    expect(new PerfMetricEmitter({}).isEnabled()).to.equal(false);
    expect(
      new PerfMetricEmitter({ url: 'http://localhost:8086', token: 't' }).isEnabled(),
    ).to.equal(false);
    expect(
      new PerfMetricEmitter({
        url: 'http://localhost:8086',
        token: 't',
        org: 'o',
        bucket: 'b',
      }).isEnabled(),
    ).to.equal(true);
  });

  it('emitPerfRun returns false + skips fetch when disabled', async () => {
    const { fetchImpl, calls } = makeMockFetch(204);
    const emitter = new PerfMetricEmitter({ fetchImpl });
    const ok = await emitter.emitPerfRun(BASE_PERF);
    expect(ok).to.equal(false);
    expect(calls).to.have.length(0);
  });

  it('emitPerfRun returns true on 2xx', async () => {
    const { fetchImpl, calls } = makeMockFetch(204);
    const emitter = new PerfMetricEmitter({
      url: 'http://localhost:8086',
      token: 'tok',
      org: 'org-x',
      bucket: 'bk-y',
      fetchImpl,
    });
    const ok = await emitter.emitPerfRun(BASE_PERF);
    expect(ok).to.equal(true);
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.include('/api/v2/write');
    expect(calls[0].url).to.include('org=org-x');
    expect(calls[0].url).to.include('bucket=bk-y');
    expect(calls[0].url).to.include('precision=ns');
    expect((calls[0].init?.headers as Record<string, string>)?.Authorization).to.equal('Token tok');
  });

  it('emitPerfRun returns false on non-2xx without throw', async () => {
    const { fetchImpl } = makeMockFetch(500);
    const emitter = new PerfMetricEmitter({
      url: 'http://localhost:8086',
      token: 'tok',
      org: 'o',
      bucket: 'b',
      fetchImpl,
    });
    const ok = await emitter.emitPerfRun(BASE_PERF);
    expect(ok).to.equal(false);
  });

  it('emitPerfRun returns false when fetch throws', async () => {
    const fetchImpl = (async () => {
      throw new Error('econnrefused');
    }) as unknown as typeof fetch;
    const emitter = new PerfMetricEmitter({
      url: 'http://localhost:8086',
      token: 'tok',
      org: 'o',
      bucket: 'b',
      fetchImpl,
    });
    const ok = await emitter.emitPerfRun(BASE_PERF);
    expect(ok).to.equal(false);
  });
});

describe('createPerfMetricEmitterFromEnv', () => {
  it('passes env to constructor', () => {
    const e = createPerfMetricEmitterFromEnv({
      INFLUX_URL: 'http://x',
      INFLUX_TOKEN: 't',
      INFLUX_ORG: 'o',
      INFLUX_BUCKET: 'b',
    });
    expect(e.isEnabled()).to.equal(true);
  });

  it('disabled when env missing', () => {
    expect(createPerfMetricEmitterFromEnv({}).isEnabled()).to.equal(false);
  });
});

describe('runPerfFlow', () => {
  it('collects N durations + emits metric + returns stats', async () => {
    const emitted: PerfRunMetric[] = [];
    const fakeEmitter = {
      isEnabled: () => true,
      emitPerfRun: async (m: PerfRunMetric) => {
        emitted.push(m);
        return true;
      },
    } as unknown as PerfMetricEmitter;

    const seq = [800, 900, 1000, 1100, 1900];
    let i = 0;
    const result = await runPerfFlow({
      flow: 'login',
      testId: 'TC_PERF_LOGIN_001',
      thresholdMs: 2000,
      iterations: 5,
      meta: { env: 'local', device: 'pixel-7', branch: 'main' },
      emitter: fakeEmitter,
      actionFn: async () => seq[i++],
    });

    expect(result.stats.count).to.equal(5);
    expect(result.stats.p95).to.equal(1900);
    expect(result.withinSla).to.equal(true);
    expect(emitted).to.have.length(1);
    expect(emitted[0].p95Ms).to.equal(1900);
    expect(emitted[0].thresholdMs).to.equal(2000);
    expect(emitted[0].withinSla).to.equal(true);
  });

  it('flags withinSla=false when p95 exceeds threshold', async () => {
    const fakeEmitter = {
      isEnabled: () => false,
      emitPerfRun: async () => false,
    } as unknown as PerfMetricEmitter;

    const seq = [500, 600, 700, 800, 2500];
    let i = 0;
    const result = await runPerfFlow({
      flow: 'search',
      testId: 'TC_PERF_SEARCH_001',
      thresholdMs: 1500,
      iterations: 5,
      meta: { env: 'local', device: 'd', branch: 'b' },
      emitter: fakeEmitter,
      actionFn: async () => seq[i++],
    });
    expect(result.stats.p95).to.equal(2500);
    expect(result.withinSla).to.equal(false);
  });

  it('throws on iterations < 1', async () => {
    let threw = false;
    try {
      await runPerfFlow({
        flow: 'login',
        testId: 'X',
        thresholdMs: 1000,
        iterations: 0,
        meta: { env: 'local', device: 'd', branch: 'b' },
        actionFn: async () => 100,
      });
    } catch (e) {
      threw = true;
      expect((e as Error).message).to.match(/iterations must be >= 1/);
    }
    expect(threw).to.equal(true);
  });

  it('throws on invalid action duration', async () => {
    const fakeEmitter = {
      isEnabled: () => false,
      emitPerfRun: async () => false,
    } as unknown as PerfMetricEmitter;
    let threw = false;
    try {
      await runPerfFlow({
        flow: 'login',
        testId: 'X',
        thresholdMs: 1000,
        iterations: 2,
        meta: { env: 'local', device: 'd', branch: 'b' },
        emitter: fakeEmitter,
        actionFn: async () => -1,
      });
    } catch (e) {
      threw = true;
      expect((e as Error).message).to.match(/invalid duration/);
    }
    expect(threw).to.equal(true);
  });
});
