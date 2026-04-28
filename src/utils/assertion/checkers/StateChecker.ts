/**
 * StateChecker — query app state (shared_prefs / secure_storage / sqlite / debug_api)
 * và validate qua predicate.
 *
 * Spec ref: §5.4 (State layer), §6.
 * Plan ref: M2 Task 5, Decision §4.D2 (executeScript primary + adb fallback),
 * Debt D4 (adb-only M2 → real backend M3+).
 *
 * Design: DI cho `getValue` adapter. Checker chỉ chứa predicate logic
 * (equals / not_null / regex). Runtime adapter quyết định backend
 * (Appium executeScript vs adb shell). M2 ship adb adapter cho Sauce Demo
 * (debuggable APK); `mobile:executeScript` adapter defer M3.
 */
import type { StateCheck } from '../../../contracts/_schema';
import type { CheckOutcome } from '../types';

export interface StateLookupArgs {
  source: 'shared_prefs' | 'secure_storage' | 'sqlite' | 'debug_api';
  /** Required cho shared_prefs/secure_storage/sqlite (schema enforces). */
  package?: string;
  key: string;
}

export interface StateCheckerDeps {
  /**
   * Trả raw value từ device storage. `null` nếu key không tồn tại.
   * Throw nếu lookup fail (permission, file not found, parse error, …).
   */
  getValue: (args: StateLookupArgs) => Promise<string | null>;
}

export class StateChecker {
  constructor(private readonly deps: StateCheckerDeps) {}

  async run(check: StateCheck): Promise<CheckOutcome> {
    switch (check.type) {
      case 'state_property':
        return this.stateProperty(check);
    }
  }

  private async stateProperty(
    check: Extract<StateCheck, { type: 'state_property' }>,
  ): Promise<CheckOutcome> {
    let value: string | null;
    try {
      value = await this.deps.getValue({
        source: check.source,
        package: check.package,
        key: check.key,
      });
    } catch (err) {
      return {
        passed: false,
        message: `state lookup ${check.source}:${check.key} threw: ${errMsg(err)}`,
        evidence: [],
      };
    }

    const expect = check.expect;
    const target = `${check.source}:${check.key}`;

    if ('equals' in expect) {
      const expected = expect.equals;
      // Strict-equal cho primitive; sâu hơn = JSON compare.
      const matched =
        value !== null && (Object.is(value, expected) || value === stringifyExpected(expected));
      if (matched) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `state ${target}: expected equals ${stringifyExpected(expected)}, got ${displayValue(value)}`,
        evidence: [],
      };
    }

    if ('not_null' in expect) {
      if (value !== null && value !== '') return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `state ${target}: expected not_null, got ${displayValue(value)}`,
        evidence: [],
      };
    }

    if ('regex' in expect) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(expect.regex);
      } catch (err) {
        return {
          passed: false,
          message: `state ${target}: invalid regex /${expect.regex}/: ${errMsg(err)}`,
          evidence: [],
        };
      }
      if (value !== null && pattern.test(value)) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `state ${target}: expected /${expect.regex}/, got ${displayValue(value)}`,
        evidence: [],
      };
    }

    // Schema discriminated union exhausted — should never reach.
    return {
      passed: false,
      message: `state ${target}: unknown expect predicate`,
      evidence: [],
    };
  }
}

function stringifyExpected(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function displayValue(v: string | null): string {
  if (v === null) return '<null>';
  return `"${v}"`;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
