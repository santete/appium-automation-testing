/**
 * Decision tree classifier — rule-based core (spec §6.1 + §6.2).
 *
 * Plan ref: M5 Task 1.
 *
 * Rule order = priority. Engine (engine.ts) chạy lần lượt → first-match-wins.
 * `UNKNOWN` fallback cuối cùng để LLM escalator Task 2 catch.
 *
 * Confidence scoring:
 *   - 0.95: signal cứng (HTTP 5xx, schema validation flag, data conflict marker)
 *   - 0.85: signal kết hợp (locator + UI + reproducible)
 *   - 0.80: heuristic regex (text match)
 *   - 0.70: weak signal (chỉ 1 field, ambiguous)
 *
 * Threshold caller (M5 Task 2) dùng: confidence < 0.85 → escalate LLM.
 */
import type { ClassifierInput, FailureClassification } from './types';

export interface ClassifierRule {
  name: string;
  matches: (input: ClassifierInput) => boolean;
  classify: (input: ClassifierInput) => Omit<FailureClassification, 'testId' | 'matchedRule'>;
}

const FLAKY_REPRO_THRESHOLD = 0.9; // < 90% pass on retry → FLAKY
const LOCATOR_REGEX =
  /(no such element|element.*not.*found|element not interactable|stale element)/i;
const ANIMATION_REGEX = /(animation|transition.*not.*finished|ui not.*settled)/i;
const ASSERTION_WRONG_REGEX =
  /(assertion.*never.*executed|expected.*never.*ran|missing.*assertion|wrong assertion)/i;
const TIMEOUT_REGEX = /(timeout|timed out|connection refused)/i;

export const RULES: ClassifierRule[] = [
  // ── 1. CI-only fail → ENV_ISSUE (signal cứng) ───────────────────────
  {
    name: 'env-issue:ci-only-pass-locally',
    matches: (i) => i.envContext === 'ci-only' && i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
    classify: (i) => ({
      category: 'ENV_ISSUE',
      layer: i.layer,
      reproducible: true,
      reproductionRate: i.reproductionRate,
      routeTo: 3,
      assignTo: 'devops_team',
      priority: 'P1',
      rootCause: {
        description: 'Test fail on CI nhưng pass local — env config / network / device mismatch.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.95,
    }),
  },

  // ── 2. Data conflict marker → DATA_ISSUE ────────────────────────────
  {
    name: 'data-issue:conflict-marker',
    matches: (i) => Boolean(i.hasDataConflictMarker),
    classify: (i) => ({
      category: 'DATA_ISSUE',
      layer: i.layer,
      reproducible: i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
      reproductionRate: i.reproductionRate,
      routeTo: 3,
      assignTo: 'qa_team',
      priority: 'P1',
      rootCause: {
        description: 'Test isolation broken — duplicate fixture / pool exhausted / shared state.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.95,
    }),
  },

  // ── 3. Schema validation fail → BUG (contract drift) ────────────────
  {
    name: 'bug:schema-validation-fail',
    matches: (i) => Boolean(i.hasSchemaValidationError) && i.layer === 'API',
    classify: (i) => ({
      category: 'BUG',
      layer: 'API',
      reproducible: i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
      reproductionRate: i.reproductionRate,
      routeTo: 1, // requirement update khi contract drift
      assignTo: 'dev_team',
      priority: 'P0',
      rootCause: {
        description: 'API response schema khác contract — backend thay đổi response shape.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.95,
    }),
  },

  // ── 4. HTTP 5xx → BUG (server error) ────────────────────────────────
  {
    name: 'bug:api-5xx',
    matches: (i) =>
      i.layer === 'API' &&
      typeof i.httpStatusCode === 'number' &&
      i.httpStatusCode >= 500 &&
      i.httpStatusCode < 600,
    classify: (i) => ({
      category: 'BUG',
      layer: 'API',
      reproducible: i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
      reproductionRate: i.reproductionRate,
      routeTo: 1,
      assignTo: 'dev_team',
      priority: 'P0',
      rootCause: {
        description: `API trả ${i.httpStatusCode} — server-side bug.`,
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.95,
    }),
  },

  // ── 5. Perf regression → BUG (perf, route step 2) ───────────────────
  {
    name: 'bug:perf-regression',
    matches: (i) => i.layer === 'PERF' && i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
    classify: (i) => ({
      category: 'BUG',
      layer: 'PERF',
      reproducible: true,
      reproductionRate: i.reproductionRate,
      routeTo: 2, // review SLA contract
      assignTo: 'dev_team',
      priority: 'P1',
      rootCause: {
        description: 'Performance threshold breached reproducibly — perf bug hoặc SLA cần revise.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.9,
    }),
  },

  // ── 6. Wrong assertion → SCRIPT_ISSUE (route step 2) ────────────────
  {
    name: 'script-issue:wrong-assertion',
    matches: (i) =>
      Boolean(i.hasMissingAssertionMarker) || ASSERTION_WRONG_REGEX.test(i.errorMessage),
    classify: (i) => ({
      category: 'SCRIPT_ISSUE',
      layer: i.layer,
      reproducible: i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
      reproductionRate: i.reproductionRate,
      routeTo: 2, // contract design review
      assignTo: 'qa_team',
      priority: 'P1',
      rootCause: {
        description:
          'Assertion contract sai hoặc thiếu — test PASS dù không verify expected behavior.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.85,
    }),
  },

  // ── 7. Locator/animation issue (UI + reproducible) → SCRIPT_ISSUE ───
  {
    name: 'script-issue:locator-or-animation',
    matches: (i) =>
      i.layer === 'UI' &&
      i.reproductionRate >= FLAKY_REPRO_THRESHOLD &&
      (Boolean(i.hasLocatorOrAnimationIssue) ||
        LOCATOR_REGEX.test(i.errorMessage) ||
        ANIMATION_REGEX.test(i.errorMessage)),
    classify: (i) => ({
      category: 'SCRIPT_ISSUE',
      layer: 'UI',
      reproducible: true,
      reproductionRate: i.reproductionRate,
      routeTo: 4, // implement (locator update / wait strategy)
      assignTo: 'qa_team',
      priority: 'P2',
      rootCause: {
        description:
          'Locator stale / animation chưa settled — cần update Page Object hoặc wait strategy.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.85,
    }),
  },

  // ── 8. Flaky (intermittent, no other signal) → FLAKY (step 5) ───────
  {
    name: 'flaky:intermittent',
    matches: (i) => i.reproductionRate > 0 && i.reproductionRate < FLAKY_REPRO_THRESHOLD,
    classify: (i) => ({
      category: 'FLAKY',
      layer: i.layer,
      reproducible: false,
      reproductionRate: i.reproductionRate,
      routeTo: 5, // execution stability
      assignTo: 'qa_team',
      priority: i.reproductionRate < 0.5 ? 'P1' : 'P2',
      rootCause: {
        description: `Intermittent fail — reproduction rate ${(i.reproductionRate * 100).toFixed(0)}%. Cần stability investigation.`,
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.9,
    }),
  },

  // ── 9. Network timeout reproducible → ENV_ISSUE weak ────────────────
  {
    name: 'env-issue:network-timeout',
    matches: (i) =>
      i.layer === 'API' &&
      TIMEOUT_REGEX.test(i.errorMessage) &&
      i.reproductionRate >= FLAKY_REPRO_THRESHOLD,
    classify: (i) => ({
      category: 'ENV_ISSUE',
      layer: 'API',
      reproducible: true,
      reproductionRate: i.reproductionRate,
      routeTo: 3,
      assignTo: 'devops_team',
      priority: 'P1',
      rootCause: {
        description:
          'API timeout / connection refused reproducible — backend down hoặc network policy.',
        evidence: i.evidenceFiles ?? [],
      },
      confidence: 0.8,
    }),
  },
];

/** UNKNOWN fallback — caller (LLM escalator) consume khi engine return nó. */
export function unknownClassification(input: ClassifierInput): FailureClassification {
  return {
    testId: input.testId,
    category: 'UNKNOWN',
    layer: input.layer,
    reproducible: input.reproductionRate >= FLAKY_REPRO_THRESHOLD,
    reproductionRate: input.reproductionRate,
    routeTo: 7, // analyze & debug step
    assignTo: 'qa_team',
    priority: 'P2',
    rootCause: {
      description: 'Rule-based classifier không match — cần LLM escalation hoặc human review.',
      evidence: input.evidenceFiles ?? [],
    },
    confidence: 0,
    matchedRule: 'no-match',
  };
}
