/**
 * Runtime types cho AssertionRunner — KHÔNG dùng cho contract YAML
 * (contract types đã infer ở `src/contracts/_schema.ts`).
 *
 * Spec ref: §5.4 Assertion Composition, §6.3 FailureMetadata.
 */
import type { Severity } from '../../contracts/_schema';

export { Severity } from '../../contracts/_schema';
export type {
  AssertionContract,
  AnyCheck,
  UiCheck,
  ApiCheck,
  StateCheck,
  NegativeCheck,
  PerfCheck,
} from '../../contracts/_schema';

/** Layer name — 1 trong 5 lớp assertion. */
export type Layer = 'UI' | 'API' | 'STATE' | 'NEGATIVE' | 'PERF';

/**
 * Outcome of 1 check (per-checker return).
 * Runner wraps this thành `AssertionResult` (thêm id/layer/type/severity/durationMs).
 *
 * `message` BẮT BUỘC khi `passed=false` — runner asserts invariant này.
 */
export interface CheckOutcome {
  passed: boolean;
  message?: string;
  evidence: string[];
}

/** Verdict cuối cùng của 1 contract execution. */
export type Verdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

/** 1 record per assertion executed. */
export interface AssertionResult {
  id: string;
  layer: Layer;
  type: string;
  severity: Severity;
  passed: boolean;
  /** human-readable message; bắt buộc khi `passed=false` */
  message?: string;
  /** Đường dẫn file đính kèm Allure (screenshot, page source, har, ...) */
  evidence: string[];
  durationMs: number;
  /** Set true nếu assertion là `negative` với `securityImpact: true`. */
  securityImpact?: boolean;
}

/** Output của AssertionRunner.runContract(). */
export interface VerdictResult {
  contractId: string;
  testScenario: string;
  status: Verdict;
  results: AssertionResult[];
  /** True nếu critical fail làm runner stop trước khi chạy hết. */
  stoppedEarly: boolean;
  /** Set khi status=FAIL — để feedback routing (spec §6.3). */
  failureMetadata?: FailureMetadata;
  startedAt: string;
  finishedAt: string;
}

/**
 * FailureMetadata — spec §6.3.
 * M2 chỉ EMIT (không thực sự route tới Slack/Linear).
 * M5 sẽ pick up + auto-classify + route.
 */
export interface FailureMetadata {
  testId: string;
  category: 'BUG' | 'SCRIPT_ISSUE' | 'FLAKY' | 'ENV_ISSUE' | 'DATA_ISSUE';
  /** Layer của FIRST critical fail (hoặc highest-severity fail nếu không có critical). */
  layer: Layer;
  reproducible: boolean;
  /** 0..1; M2 default 1.0 (single run) — M5 sẽ tính qua history. */
  reproductionRate: number;
  rootCause: {
    description: string;
    evidence: string[];
  };
  /** 1..8 — workflow step để route feedback (spec §3 + §6.2). */
  routeTo: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  assignTo: 'dev_team' | 'qa_team' | 'devops_team';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** Set true nếu có critical (security) fail. */
  securityImpact?: boolean;
}
