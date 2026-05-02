/**
 * Failure classifier types — shape khớp `FailureMetadata` spec §6.3.
 *
 * Plan ref: M5 Task 1.
 *
 * Input gọi là `ClassifierInput` (signals quan sát được từ test runner +
 * CI metadata) còn output `FailureClassification` extend `FailureMetadata`
 * với `confidence` + `matchedRule` (traceability — debug được rule nào đã
 * fire để match).
 *
 * `category=UNKNOWN` reserved cho trường hợp rule-only không match — caller
 * (LLM escalator Task 2) sẽ gọi adapter để classify, hoặc fallback human review.
 */
export type FailureCategory =
  | 'BUG'
  | 'SCRIPT_ISSUE'
  | 'FLAKY'
  | 'ENV_ISSUE'
  | 'DATA_ISSUE'
  | 'UNKNOWN';

export type FailureLayer = 'UI' | 'API' | 'STATE' | 'PERF';

/** Workflow step 1-8 (spec §2-3). */
export type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type AssignTo = 'dev_team' | 'qa_team' | 'devops_team';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface ClassifierInput {
  testId: string;
  errorMessage: string;
  layer: FailureLayer;

  /** 0-1, từ N gần nhất (M5 Task 3 detector cung cấp). */
  reproductionRate: number;

  /** Khi tổ hợp env chỉ fail ở CI → ENV_ISSUE candidate. */
  envContext: 'ci-only' | 'local-only' | 'both' | 'unknown';

  evidenceFiles?: string[];

  // ── Structured signals (optional — nếu collector wire được) ───────────
  /** HTTP status từ API call cuối (nếu API layer). */
  httpStatusCode?: number;

  /** Zod / JSON-schema validation error trên response. */
  hasSchemaValidationError?: boolean;

  /** Marker từ test isolation check (vd. duplicate user id, account pool exhausted). */
  hasDataConflictMarker?: boolean;

  /** Indicator locator stale / element-not-interactable / animation. */
  hasLocatorOrAnimationIssue?: boolean;

  /** Test PASS but contract assertion never executed → wrong assertion. */
  hasMissingAssertionMarker?: boolean;
}

export interface FailureClassification {
  testId: string;
  category: FailureCategory;
  layer: FailureLayer;
  reproducible: boolean;
  reproductionRate: number;
  routeTo: WorkflowStep;
  assignTo: AssignTo;
  priority: Priority;
  rootCause: {
    description: string;
    evidence: string[];
  };
  /** 0-1, confidence của rule fire. UNKNOWN luôn `0`. */
  confidence: number;
  /** Tên rule fired (debug + audit). UNKNOWN = `'no-match'`. */
  matchedRule: string;
}
