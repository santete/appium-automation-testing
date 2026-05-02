/**
 * Flaky detection — combined threshold per M5 plan Decision 7:
 *   pass rate < 90% over last 30 runs AND ≥ 1 fail in last 5 runs.
 *
 * Plan ref: M5 Task 3.
 *
 * Combined ngăn 2 false-positive shape:
 *   - "Old flaky đã fix" (low rate but recent runs all pass) → KHÔNG quarantine
 *     vì recentFailCount = 0.
 *   - "Single recent fail trên test stable" (29/30 pass + 1 recent fail) → KHÔNG
 *     quarantine vì pass rate ≥ 90%.
 *
 * Min sample 5 runs — chưa đủ data → undecided (skip).
 *
 * Caller (`scripts/auto-quarantine-pr.cjs`):
 *   1. Load test history JSON từ CI artifact.
 *   2. Group by testId.
 *   3. Call `detectFlaky(records)` mỗi test → verdicts.
 *   4. Filter `shouldQuarantine === true` → append YAML entry + open PR.
 */
export interface TestRunRecord {
  testId: string;
  runId: string;
  status: 'pass' | 'fail';
  /** ISO 8601; sort newest-first khi feed vào detector. */
  timestamp: string;
}

export interface FlakyVerdict {
  testId: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  passRate: number;
  recentFailCount: number;
  shouldQuarantine: boolean;
  reason: string;
}

export const DETECTOR_WINDOW_SIZE = 30;
export const DETECTOR_RECENT_WINDOW = 5;
export const DETECTOR_PASS_RATE_THRESHOLD = 0.9;
export const DETECTOR_MIN_RECENT_FAILS = 1;
export const DETECTOR_MIN_SAMPLE = 5;

/**
 * Records cho 1 test, đã sort by timestamp **descending** (newest đầu mảng).
 * Caller responsibility — detector không re-sort.
 */
export function detectFlaky(records: TestRunRecord[]): FlakyVerdict {
  if (records.length === 0) {
    return emptyVerdict('', 'no records');
  }
  const testId = records[0].testId;
  const window = records.slice(0, DETECTOR_WINDOW_SIZE);
  const totalRuns = window.length;
  const passCount = window.filter((r) => r.status === 'pass').length;
  const failCount = totalRuns - passCount;
  const passRate = totalRuns > 0 ? passCount / totalRuns : 0;
  const recentFailCount = window
    .slice(0, DETECTOR_RECENT_WINDOW)
    .filter((r) => r.status === 'fail').length;

  if (totalRuns < DETECTOR_MIN_SAMPLE) {
    return {
      testId,
      totalRuns,
      passCount,
      failCount,
      passRate,
      recentFailCount,
      shouldQuarantine: false,
      reason: `Insufficient data (${totalRuns} runs < min ${DETECTOR_MIN_SAMPLE}) — undecided.`,
    };
  }

  const passRateBelow = passRate < DETECTOR_PASS_RATE_THRESHOLD;
  const recentFailMet = recentFailCount >= DETECTOR_MIN_RECENT_FAILS;
  const shouldQuarantine = passRateBelow && recentFailMet;

  let reason: string;
  if (shouldQuarantine) {
    reason = `Flaky: pass rate ${(passRate * 100).toFixed(1)}% < 90% over ${totalRuns} runs AND ${recentFailCount} fail(s) in last ${DETECTOR_RECENT_WINDOW} runs.`;
  } else if (!passRateBelow) {
    reason = `Stable: pass rate ${(passRate * 100).toFixed(1)}% >= 90%.`;
  } else {
    reason = `Recovering: pass rate ${(passRate * 100).toFixed(1)}% < 90% nhưng 0 fail in last ${DETECTOR_RECENT_WINDOW} runs — skip quarantine.`;
  }

  return {
    testId,
    totalRuns,
    passCount,
    failCount,
    passRate,
    recentFailCount,
    shouldQuarantine,
    reason,
  };
}

/**
 * Group records by testId + apply detector. History array có thể không sort —
 * helper handle.
 */
export function detectFlakyAll(history: TestRunRecord[]): FlakyVerdict[] {
  const byTest = new Map<string, TestRunRecord[]>();
  for (const r of history) {
    const arr = byTest.get(r.testId) ?? [];
    arr.push(r);
    byTest.set(r.testId, arr);
  }
  const verdicts: FlakyVerdict[] = [];
  for (const [, recs] of byTest) {
    recs.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    verdicts.push(detectFlaky(recs));
  }
  return verdicts;
}

function emptyVerdict(testId: string, reason: string): FlakyVerdict {
  return {
    testId,
    totalRuns: 0,
    passCount: 0,
    failCount: 0,
    passRate: 0,
    recentFailCount: 0,
    shouldQuarantine: false,
    reason,
  };
}
