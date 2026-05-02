/**
 * Unit tests cho InfluxDB metric emitter (M5 Task 6).
 *
 * Cover:
 *  - buildTestRunLine: tag escape (space, comma, equals); status pass/fail → 1/0i;
 *    duration_ms truncate negative + round float; category optional.
 *  - InfluxEmitter.isEnabled(): toàn bộ env required mới enabled.
 *  - emitTestRun: HTTP 204 success → true; non-2xx → false (no throw); fetch
 *    throw → false (best-effort); disabled → false + no fetch call.
 *  - URL build: org + bucket URL-encoded; precision=ns.
 *  - createInfluxEmitterFromEnv factory.
 *
 * Mock fetch: inject `fetchImpl` constructor option (cùng pattern llm.spec).
 */
import { expect } from 'chai';
import {
  InfluxEmitter,
  buildTestRunLine,
  createInfluxEmitterFromEnv,
  type TestRunMetric,
} from '../../src/utils/metrics/influxEmitter';

function makeMockFetch(
  status: number,
  body = '',
): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const BASE_METRIC: TestRunMetric = {
  testId: 'TC_LOGIN_001',
  suite: 'smoke',
  env: 'local',
  device: 'pixel-7',
  branch: 'main',
  durationMs: 4321,
  status: 'pass',
};

describe('buildTestRunLine', () => {
  it('emit measurement + tags + fields theo line-protocol', () => {
    const line = buildTestRunLine(BASE_METRIC, 1735689600000000000n);
    expect(line).to.equal(
      'test_run,test_id=TC_LOGIN_001,suite=smoke,env=local,device=pixel-7,branch=main duration_ms=4321i,status=1i 1735689600000000000',
    );
  });

  it('status=fail → status=0i', () => {
    const line = buildTestRunLine({ ...BASE_METRIC, status: 'fail' }, 1n);
    expect(line).to.contain('status=0i');
  });

  it('escape spaces, commas, equals trong tag value', () => {
    const line = buildTestRunLine(
      { ...BASE_METRIC, testId: 'login spec, v=2', branch: 'feat/abc' },
      1n,
    );
    expect(line).to.contain('test_id=login\\ spec\\,\\ v\\=2');
    expect(line).to.contain('branch=feat/abc');
  });

  it('duration âm clamp về 0', () => {
    const line = buildTestRunLine({ ...BASE_METRIC, durationMs: -50 }, 1n);
    expect(line).to.contain('duration_ms=0i');
  });

  it('duration float round int', () => {
    const line = buildTestRunLine({ ...BASE_METRIC, durationMs: 123.7 }, 1n);
    expect(line).to.contain('duration_ms=124i');
  });

  it('category optional → append field string khi có', () => {
    const line = buildTestRunLine({ ...BASE_METRIC, category: 'BUG' }, 1n);
    expect(line).to.contain('category="BUG"');
  });

  it('category escape quote và backslash', () => {
    const line = buildTestRunLine({ ...BASE_METRIC, category: 'a"b\\c' }, 1n);
    expect(line).to.contain('category="a\\"b\\\\c"');
  });

  it('default timestamp = now (ns) khi không truyền', () => {
    const before = BigInt(Date.now()) * 1_000_000n;
    const line = buildTestRunLine(BASE_METRIC);
    const tsStr = line.split(' ').pop()!;
    const ts = BigInt(tsStr);
    expect(ts >= before).to.equal(true);
  });
});

describe('InfluxEmitter.isEnabled', () => {
  it('false khi thiếu url/token/org/bucket', () => {
    expect(new InfluxEmitter({}).isEnabled()).to.equal(false);
    expect(new InfluxEmitter({ url: 'http://x', token: 't', org: 'o' }).isEnabled()).to.equal(
      false,
    );
  });

  it('true khi đủ 4 field', () => {
    const e = new InfluxEmitter({
      url: 'http://localhost:8086',
      token: 'tok',
      org: 'org',
      bucket: 'bucket',
    });
    expect(e.isEnabled()).to.equal(true);
  });
});

describe('InfluxEmitter.emitTestRun', () => {
  it('disabled → return false + KHÔNG call fetch', async () => {
    const { fetchImpl, calls } = makeMockFetch(204);
    const e = new InfluxEmitter({ fetchImpl });
    const ok = await e.emitTestRun(BASE_METRIC);
    expect(ok).to.equal(false);
    expect(calls).to.have.lengthOf(0);
  });

  it('happy path 204 → true + URL chứa org+bucket+precision', async () => {
    const { fetchImpl, calls } = makeMockFetch(204);
    const e = new InfluxEmitter({
      url: 'http://localhost:8086',
      token: 'TOK',
      org: 'mobile-automation',
      bucket: 'test-runs',
      fetchImpl,
    });
    const ok = await e.emitTestRun(BASE_METRIC);
    expect(ok).to.equal(true);
    expect(calls).to.have.lengthOf(1);
    expect(calls[0].url).to.equal(
      'http://localhost:8086/api/v2/write?org=mobile-automation&bucket=test-runs&precision=ns',
    );
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).to.equal('Token TOK');
    expect(headers['Content-Type']).to.equal('text/plain; charset=utf-8');
    expect(calls[0].init?.method).to.equal('POST');
  });

  it('non-2xx → return false (không throw)', async () => {
    const { fetchImpl } = makeMockFetch(401, 'unauthorized');
    const e = new InfluxEmitter({
      url: 'http://localhost:8086',
      token: 'BAD',
      org: 'o',
      bucket: 'b',
      fetchImpl,
    });
    const ok = await e.emitTestRun(BASE_METRIC);
    expect(ok).to.equal(false);
  });

  it('fetch throw network → return false (best-effort)', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const e = new InfluxEmitter({
      url: 'http://localhost:8086',
      token: 't',
      org: 'o',
      bucket: 'b',
      fetchImpl,
    });
    const ok = await e.emitTestRun(BASE_METRIC);
    expect(ok).to.equal(false);
  });

  it('URL-encode org/bucket có ký tự đặc biệt', async () => {
    const { fetchImpl, calls } = makeMockFetch(204);
    const e = new InfluxEmitter({
      url: 'http://localhost:8086',
      token: 't',
      org: 'org with space',
      bucket: 'bucket/v2',
      fetchImpl,
    });
    await e.emitTestRun(BASE_METRIC);
    expect(calls[0].url).to.contain('org=org%20with%20space');
    expect(calls[0].url).to.contain('bucket=bucket%2Fv2');
  });
});

describe('createInfluxEmitterFromEnv', () => {
  it('build emitter từ env keys', () => {
    const e = createInfluxEmitterFromEnv({
      INFLUX_URL: 'http://x:8086',
      INFLUX_TOKEN: 'tok',
      INFLUX_ORG: 'org',
      INFLUX_BUCKET: 'bucket',
    });
    expect(e.isEnabled()).to.equal(true);
  });

  it('thiếu env → emitter disabled', () => {
    const e = createInfluxEmitterFromEnv({});
    expect(e.isEnabled()).to.equal(false);
  });
});
