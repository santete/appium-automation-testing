/**
 * LLM escalator — fallback classifier khi rule-based engine return UNKNOWN
 * hoặc confidence < threshold.
 *
 * Plan ref: M5 Task 2.
 *
 * Flow:
 *   1. Caller gọi `classify(input)` (engine.ts) → có thể return UNKNOWN.
 *   2. Caller gọi `escalateIfNeeded(input, initial, deps)`.
 *      - Nếu initial.confidence >= threshold AND category != UNKNOWN → trả nguyên.
 *      - Else → build prompt + zod schema, call adapter.suggest().
 *      - Record cost qua budget tracker; nếu vượt → swallow `LlmBudgetExceededError`,
 *        return initial (UNKNOWN).
 *      - Nếu adapter throw `LlmInvalidOutputError` / `LlmConfigError` → return initial.
 *      - Unexpected error → bubble.
 *
 * Budget gate ordering: KHÔNG check budget trước call (race với concurrent
 * adapter); thay vào đó adapter.suggest() chạy → tracker.record(cost) sau.
 * Nếu record throw `LlmBudgetExceededError`, request "cuối cùng" vẫn được
 * thực hiện (trade-off: adapter pattern stateless → caller decide gating).
 *
 * Caller có thể proactively check `tracker.getCurrentSpend()` trước call để
 * skip request hoàn toàn khi gần cap (acceptable approximation).
 */
import { z } from 'zod';
import type { LlmAdapter } from '../llm/types';
import { LlmBudgetExceededError, LlmConfigError, LlmInvalidOutputError } from '../llm/types';
import type { LlmBudgetTracker } from '../llm/budget';
import type {
  ClassifierInput,
  FailureCategory,
  FailureClassification,
  WorkflowStep,
} from './types';
import { logger } from '../logger';

/** Confidence threshold dưới đây sẽ trigger escalation. */
export const ESCALATE_CONFIDENCE_THRESHOLD = 0.85;

/** LLM output schema — match `FailureClassification` core fields. */
const LlmClassificationSchema = z.object({
  category: z.enum(['BUG', 'SCRIPT_ISSUE', 'FLAKY', 'ENV_ISSUE', 'DATA_ISSUE', 'UNKNOWN']),
  routeTo: z.number().int().min(1).max(8),
  rootCauseDescription: z.string().min(10),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
});
type LlmClassification = z.infer<typeof LlmClassificationSchema>;

export interface EscalatorDeps {
  adapter: LlmAdapter;
  tracker: LlmBudgetTracker;
}

/**
 * Decide nếu initial classification cần escalate.
 *
 * - `initial.category === 'UNKNOWN'` → always escalate.
 * - `initial.confidence < threshold` → escalate.
 * - Else → no.
 */
export function shouldEscalate(initial: FailureClassification): boolean {
  return initial.category === 'UNKNOWN' || initial.confidence < ESCALATE_CONFIDENCE_THRESHOLD;
}

export async function escalateIfNeeded(
  input: ClassifierInput,
  initial: FailureClassification,
  deps: EscalatorDeps,
): Promise<FailureClassification> {
  if (!shouldEscalate(initial)) {
    return initial;
  }

  const prompt = buildPrompt(input);

  let llmOut: LlmClassification;
  let costUsd: number;
  try {
    const result = await deps.adapter.suggest({
      prompt,
      outputSchema: LlmClassificationSchema,
      maxOutputTokens: 512,
      temperature: 0,
    });
    llmOut = result.output;
    costUsd = result.costUsd;
  } catch (e) {
    if (e instanceof LlmConfigError || e instanceof LlmInvalidOutputError) {
      logger.warn('LLM escalation failed → fallback rule-only', {
        testId: input.testId,
        error: (e as Error).message,
      });
      return initial;
    }
    throw e;
  }

  try {
    await deps.tracker.record(costUsd);
  } catch (e) {
    if (e instanceof LlmBudgetExceededError) {
      logger.warn('LLM budget exceeded sau escalation call → fallback rule-only', {
        testId: input.testId,
        currentSpendUsd: e.currentSpendUsd,
        budgetUsd: e.budgetUsd,
      });
      return initial;
    }
    throw e;
  }

  logger.info('LLM escalation result', {
    testId: input.testId,
    fromCategory: initial.category,
    toCategory: llmOut.category,
    confidence: llmOut.confidence,
    costUsd,
  });

  return {
    testId: input.testId,
    category: llmOut.category as FailureCategory,
    layer: input.layer,
    reproducible: input.reproductionRate >= 0.9,
    reproductionRate: input.reproductionRate,
    routeTo: llmOut.routeTo as WorkflowStep,
    assignTo: assignToFromCategory(llmOut.category as FailureCategory),
    priority: priorityFromCategory(llmOut.category as FailureCategory),
    rootCause: {
      description: `${llmOut.rootCauseDescription} [LLM reasoning: ${llmOut.reasoning}]`,
      evidence: input.evidenceFiles ?? [],
    },
    confidence: llmOut.confidence,
    matchedRule: 'llm-escalator',
  };
}

function buildPrompt(input: ClassifierInput): string {
  return [
    'You are a test failure triage classifier for mobile automation tests.',
    'Classify the failure into one of: BUG, SCRIPT_ISSUE, FLAKY, ENV_ISSUE, DATA_ISSUE, UNKNOWN.',
    'Decide which workflow step (1-8) should receive the feedback per this routing table:',
    '  1=requirement, 2=contract design, 3=test data/env, 4=implement, 5=execute,',
    '  6=validate, 7=analyze, 8=improve.',
    '',
    'Inputs:',
    `  testId: ${input.testId}`,
    `  layer: ${input.layer}`,
    `  reproductionRate: ${input.reproductionRate}`,
    `  envContext: ${input.envContext}`,
    `  httpStatusCode: ${input.httpStatusCode ?? 'n/a'}`,
    `  hasSchemaValidationError: ${input.hasSchemaValidationError ?? false}`,
    `  hasDataConflictMarker: ${input.hasDataConflictMarker ?? false}`,
    `  hasLocatorOrAnimationIssue: ${input.hasLocatorOrAnimationIssue ?? false}`,
    `  hasMissingAssertionMarker: ${input.hasMissingAssertionMarker ?? false}`,
    `  errorMessage: ${input.errorMessage}`,
    '',
    'Respond with JSON: { category, routeTo (number 1-8), rootCauseDescription, confidence (0-1), reasoning }',
  ].join('\n');
}

function assignToFromCategory(c: FailureCategory): 'dev_team' | 'qa_team' | 'devops_team' {
  if (c === 'BUG') return 'dev_team';
  if (c === 'ENV_ISSUE') return 'devops_team';
  return 'qa_team';
}

function priorityFromCategory(c: FailureCategory): 'P0' | 'P1' | 'P2' | 'P3' {
  if (c === 'BUG') return 'P0';
  if (c === 'ENV_ISSUE' || c === 'DATA_ISSUE') return 'P1';
  if (c === 'FLAKY' || c === 'SCRIPT_ISSUE') return 'P2';
  return 'P3';
}
