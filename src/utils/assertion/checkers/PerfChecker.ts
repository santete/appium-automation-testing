/**
 * PerfChecker — assert duration giữa 2 marker ≤ threshold.
 *
 * Spec ref: §5.4 (Performance layer).
 * Plan ref: M2 Task 7.
 *
 * Design: marker store là 1 abstract Map injected qua deps. Test code
 * record marker bằng `markers.set(name, Date.now())` trong page object
 * action; checker compare cuối test. Tách store khỏi checker để unit test
 * không cần global state.
 */
import type { PerfCheck } from '../../../contracts/_schema';
import type { CheckOutcome } from '../types';

export interface MarkerStore {
  /** Trả millisecond timestamp của marker, undefined nếu chưa record. */
  get(name: string): number | undefined;
}

export interface PerfCheckerDeps {
  markers: MarkerStore;
}

export class PerfChecker {
  constructor(private readonly deps: PerfCheckerDeps) {}

  async run(check: PerfCheck): Promise<CheckOutcome> {
    switch (check.type) {
      case 'time_between':
        return this.timeBetween(check);
    }
  }

  private async timeBetween(
    check: Extract<PerfCheck, { type: 'time_between' }>,
  ): Promise<CheckOutcome> {
    const start = this.deps.markers.get(check.start_marker);
    const end = this.deps.markers.get(check.end_marker);

    if (start === undefined) {
      return {
        passed: false,
        message: `time_between: start_marker "${check.start_marker}" not recorded`,
        evidence: [],
      };
    }
    if (end === undefined) {
      return {
        passed: false,
        message: `time_between: end_marker "${check.end_marker}" not recorded`,
        evidence: [],
      };
    }
    if (end < start) {
      return {
        passed: false,
        message: `time_between: end (${check.end_marker}) recorded before start (${check.start_marker})`,
        evidence: [],
      };
    }

    const duration = end - start;
    if (duration <= check.max_ms) return { passed: true, evidence: [] };
    return {
      passed: false,
      message: `time_between ${check.start_marker} → ${check.end_marker}: ${duration}ms exceeds max ${check.max_ms}ms`,
      evidence: [],
    };
  }
}

/**
 * Default in-memory store. Reset bằng `clear()` (gọi trong `beforeEach`).
 * Test code: `markers.set('login_start', Date.now())` trước khi tap;
 * `markers.set('login_end', Date.now())` khi home screen visible.
 */
export class InMemoryMarkerStore implements MarkerStore {
  private readonly data = new Map<string, number>();

  set(name: string, timestamp: number): void {
    this.data.set(name, timestamp);
  }

  get(name: string): number | undefined {
    return this.data.get(name);
  }

  clear(): void {
    this.data.clear();
  }
}
