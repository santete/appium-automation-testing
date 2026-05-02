/**
 * Unit tests cho flaky detector (M5 Task 3).
 *
 * Combined threshold: passRate < 90% AND recentFailCount >= 1.
 *
 * Cover:
 *  - Pass-only test → not quarantine.
 *  - 1 fail in 30 runs (97%) → not quarantine.
 *  - 6 fails in 30 + recent fail → quarantine.
 *  - 6 fails in 30 + 0 recent fails (recovering) → not quarantine.
 *  - <5 runs → undecided (insufficient).
 *  - All-fail → quarantine.
 *  - Edge: pass rate exactly 90% → not quarantine (strict <).
 *  - detectFlakyAll: multiple tests → independent verdicts.
 *  - detectFlakyAll: unsorted history → handled.
 */
import { expect } from 'chai';
import {
  detectFlaky,
  detectFlakyAll,
  type TestRunRecord,
  DETECTOR_WINDOW_SIZE,
} from '../../src/utils/flaky/detector';

function records(testId: string, pattern: ('p' | 'f')[]): TestRunRecord[] {
  // Newest first (index 0 = most recent run).
  return pattern.map((p, i) => ({
    testId,
    runId: `run-${i}`,
    status: p === 'p' ? 'pass' : 'fail',
    timestamp: new Date(2026, 3, 28 - i).toISOString(),
  }));
}

describe('detectFlaky — combined threshold', () => {
  it('All pass (10/10) → not flaky', () => {
    const v = detectFlaky(records('T1', Array(10).fill('p')));
    expect(v.shouldQuarantine).to.be.false;
    expect(v.passRate).to.equal(1);
    expect(v.reason).to.match(/Stable/);
  });

  it('1 fail in 30 (29/30 = 96.7%) → not quarantine', () => {
    // Recent (newest 5) all pass → pattern: pppp p (recent) ... f (old)
    const pattern: ('p' | 'f')[] = Array(29).fill('p');
    pattern.push('f'); // single fail at oldest position
    const v = detectFlaky(records('T2', pattern));
    expect(v.shouldQuarantine).to.be.false;
    expect(v.passRate).to.be.greaterThan(0.9);
  });

  it('6 fails in 30 (24/30 = 80%) + recent fail → quarantine', () => {
    const pattern: ('p' | 'f')[] = ['f', 'p', 'p', 'p', 'p']; // recent has 1 fail
    pattern.push(...Array(20).fill('p'));
    pattern.push(...Array(5).fill('f'));
    const v = detectFlaky(records('T3', pattern));
    expect(v.totalRuns).to.equal(30);
    expect(v.failCount).to.equal(6);
    expect(v.recentFailCount).to.equal(1);
    expect(v.shouldQuarantine).to.be.true;
    expect(v.reason).to.match(/Flaky/);
  });

  it('6 fails in 30 + 0 recent fails (recovering) → NOT quarantine', () => {
    const pattern: ('p' | 'f')[] = Array(5).fill('p'); // recent all pass
    pattern.push(...Array(19).fill('p'));
    pattern.push(...Array(6).fill('f'));
    const v = detectFlaky(records('T4', pattern));
    expect(v.passRate).to.be.lessThan(0.9);
    expect(v.recentFailCount).to.equal(0);
    expect(v.shouldQuarantine).to.be.false;
    expect(v.reason).to.match(/Recovering/);
  });

  it('<5 runs → undecided (insufficient)', () => {
    const v = detectFlaky(records('T5', ['f', 'f', 'p']));
    expect(v.shouldQuarantine).to.be.false;
    expect(v.reason).to.match(/Insufficient data/);
  });

  it('All-fail (10/10) → quarantine', () => {
    const v = detectFlaky(records('T6', Array(10).fill('f')));
    expect(v.passRate).to.equal(0);
    expect(v.recentFailCount).to.equal(5);
    expect(v.shouldQuarantine).to.be.true;
  });

  it('Edge: pass rate exactly 90% (27/30) → NOT quarantine (strict <)', () => {
    // 27 pass + 3 fails; 1 recent fail at index 0 to make recentFail=1
    const pattern: ('p' | 'f')[] = ['f'];
    pattern.push(...Array(27).fill('p'));
    pattern.push(...Array(2).fill('f'));
    const v = detectFlaky(records('T7', pattern));
    expect(v.passRate).to.equal(0.9);
    expect(v.recentFailCount).to.equal(1);
    expect(v.shouldQuarantine).to.be.false;
  });

  it('Edge: pass rate 89.9% + recent fail → quarantine', () => {
    // 26 pass + 4 fails; 1 recent fail
    const pattern: ('p' | 'f')[] = ['f'];
    pattern.push(...Array(26).fill('p'));
    pattern.push(...Array(3).fill('f'));
    const v = detectFlaky(records('T8', pattern));
    expect(v.passRate).to.be.lessThan(0.9);
    expect(v.shouldQuarantine).to.be.true;
  });

  it('Window cap: only consider last 30 runs', () => {
    // 50 records; first 30 are bad, oldest 20 don't count
    const pattern: ('p' | 'f')[] = Array(15).fill('f');
    pattern.push(...Array(15).fill('p'));
    pattern.push(...Array(20).fill('p')); // older — ignored
    const v = detectFlaky(records('T9', pattern));
    expect(v.totalRuns).to.equal(DETECTOR_WINDOW_SIZE);
    expect(v.failCount).to.equal(15);
    expect(v.shouldQuarantine).to.be.true;
  });

  it('Empty records → empty verdict, no quarantine', () => {
    const v = detectFlaky([]);
    expect(v.shouldQuarantine).to.be.false;
    expect(v.totalRuns).to.equal(0);
  });
});

describe('detectFlakyAll — multi-test history', () => {
  it('Multiple tests → independent verdicts', () => {
    const history: TestRunRecord[] = [
      ...records('T-stable', Array(10).fill('p')),
      ...records('T-broken', Array(10).fill('f')),
    ];
    const verdicts = detectFlakyAll(history);
    expect(verdicts).to.have.lengthOf(2);
    const stable = verdicts.find((v) => v.testId === 'T-stable');
    const broken = verdicts.find((v) => v.testId === 'T-broken');
    expect(stable?.shouldQuarantine).to.be.false;
    expect(broken?.shouldQuarantine).to.be.true;
  });

  it('Unsorted history → sort by timestamp desc internal', () => {
    const history: TestRunRecord[] = [
      { testId: 'T', runId: 'r1', status: 'pass', timestamp: '2026-01-01T00:00:00Z' },
      { testId: 'T', runId: 'r5', status: 'fail', timestamp: '2026-04-28T00:00:00Z' }, // newest, fail
      { testId: 'T', runId: 'r2', status: 'fail', timestamp: '2026-02-01T00:00:00Z' },
      { testId: 'T', runId: 'r3', status: 'fail', timestamp: '2026-03-01T00:00:00Z' },
      { testId: 'T', runId: 'r4', status: 'fail', timestamp: '2026-04-01T00:00:00Z' },
    ];
    const v = detectFlakyAll(history);
    expect(v).to.have.lengthOf(1);
    // 1 pass + 4 fails = 20% pass rate, recent (newest 5) has 4 fails
    expect(v[0].passRate).to.equal(0.2);
    expect(v[0].recentFailCount).to.equal(4);
    expect(v[0].shouldQuarantine).to.be.true;
  });
});
