/**
 * NegativeChecker — assert "không xảy ra" things (log pattern absent, process alive).
 *
 * Spec ref: §5.4 (Negative layer).
 * Plan ref: M2 Task 6, Decision §4.D4 (LogCapture post-hoc).
 *
 * Design: DI 2 deps — `logCapture` cho `log_pattern_absent`, `isProcessAlive`
 * cho `process_alive`. Cả 2 inject runtime adapter (Appium getLogs / adb pidof).
 */
import type { NegativeCheck } from '../../../contracts/_schema';
import type { CheckOutcome } from '../types';
import type { LogCapture } from '../../logCapture';

export interface NegativeCheckerDeps {
  logCapture: LogCapture;
  /** Trả true nếu process của package đang chạy. Dùng adb pidof / ps. */
  isProcessAlive: (packageName: string) => Promise<boolean>;
}

export class NegativeChecker {
  constructor(private readonly deps: NegativeCheckerDeps) {}

  async run(check: NegativeCheck): Promise<CheckOutcome> {
    switch (check.type) {
      case 'log_pattern_absent':
        return this.logPatternAbsent(check);
      case 'process_alive':
        return this.processAlive(check);
    }
  }

  private async logPatternAbsent(
    check: Extract<NegativeCheck, { type: 'log_pattern_absent' }>,
  ): Promise<CheckOutcome> {
    let pattern: RegExp;
    try {
      pattern = new RegExp(check.pattern);
    } catch (err) {
      return {
        passed: false,
        message: `log_pattern_absent invalid regex /${check.pattern}/: ${errMsg(err)}`,
        evidence: [],
      };
    }
    try {
      const result = await this.deps.logCapture.scan(check.log_source, pattern);
      if (!result.matched) return { passed: true, evidence: [] };
      const sample = result.matches.slice(0, 3).join(' | ');
      return {
        passed: false,
        message: `log_pattern_absent: ${result.matches.length} match(es) for /${check.pattern}/ in ${check.log_source}: ${sample}`,
        evidence: [],
      };
    } catch (err) {
      return {
        passed: false,
        message: `log_pattern_absent fetch error (${check.log_source}): ${errMsg(err)}`,
        evidence: [],
      };
    }
  }

  private async processAlive(
    check: Extract<NegativeCheck, { type: 'process_alive' }>,
  ): Promise<CheckOutcome> {
    try {
      const alive = await this.deps.isProcessAlive(check.package);
      if (alive) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `process_alive: package ${check.package} not running`,
        evidence: [],
      };
    } catch (err) {
      return {
        passed: false,
        message: `process_alive error checking ${check.package}: ${errMsg(err)}`,
        evidence: [],
      };
    }
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
