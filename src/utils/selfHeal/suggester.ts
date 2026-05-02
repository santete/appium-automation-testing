/**
 * Self-healing locator suggester (M5 Task 4).
 *
 * Spike doc: `docs/spikes/self-heal-locator.md`. Spec ref §7.8 + §9.4.
 *
 * Caller pattern:
 *   const result = await suggestLocators(input, { adapter, tracker });
 *   if (result.suggestions.length === 0) return; // no-op
 *   await openPRWithEdit(result.recommendation, input.pageObjectFile); // glue script
 *
 * Caller responsibility: KHÔNG auto-merge — branch protection enforce
 * human review (spike pass criteria #3).
 */
import { z } from 'zod';
import type { LlmAdapter } from '../llm/types';
import { LlmBudgetExceededError, LlmConfigError, LlmInvalidOutputError } from '../llm/types';
import type { LlmBudgetTracker } from '../llm/budget';
import { logger } from '../logger';

export interface SelfHealInput {
  testId: string;
  pageObjectFile: string;
  failingSelector: string;
  pageSourceSnippet: string;
  errorMessage: string;
}

export interface LocatorSuggestion {
  newSelector: string;
  selectorType: 'accessibility-id' | 'xpath' | 'class-by-text' | 'id' | 'css';
  confidence: number;
  reasoning: string;
}

export interface SelfHealResult {
  originalSelector: string;
  suggestions: LocatorSuggestion[];
  recommendation: LocatorSuggestion | null;
  costUsd: number;
}

export interface SelfHealDeps {
  adapter: LlmAdapter;
  tracker: LlmBudgetTracker;
}

const SuggestionSchema = z.object({
  newSelector: z.string().min(1),
  selectorType: z.enum(['accessibility-id', 'xpath', 'class-by-text', 'id', 'css']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(5),
});

const ResultSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(0).max(5),
});

const MAX_PAGE_SOURCE_CHARS = 8000; // ~2k tokens approximation

/**
 * Throws nếu LLM unreachable hoặc budget exceeded — caller phải catch để
 * gracefully degrade (skip PR, log incident).
 */
export async function suggestLocators(
  input: SelfHealInput,
  deps: SelfHealDeps,
): Promise<SelfHealResult> {
  const truncatedSource =
    input.pageSourceSnippet.length > MAX_PAGE_SOURCE_CHARS
      ? input.pageSourceSnippet.slice(0, MAX_PAGE_SOURCE_CHARS) + '\n... [truncated]'
      : input.pageSourceSnippet;

  const prompt = buildPrompt({ ...input, pageSourceSnippet: truncatedSource });

  let suggestions: LocatorSuggestion[];
  let costUsd: number;
  try {
    const result = await deps.adapter.suggest({
      prompt,
      outputSchema: ResultSchema,
      maxOutputTokens: 1024,
      temperature: 0,
    });
    suggestions = result.output.suggestions;
    costUsd = result.costUsd;
  } catch (e) {
    if (
      e instanceof LlmConfigError ||
      e instanceof LlmInvalidOutputError ||
      e instanceof LlmBudgetExceededError
    ) {
      logger.warn('Self-heal suggester unavailable → no suggestions', {
        testId: input.testId,
        error: (e as Error).message,
      });
      throw e;
    }
    throw e;
  }

  try {
    await deps.tracker.record(costUsd);
  } catch (e) {
    if (e instanceof LlmBudgetExceededError) {
      logger.warn('Self-heal budget exceeded sau call', {
        testId: input.testId,
        currentSpendUsd: e.currentSpendUsd,
      });
      throw e;
    }
    throw e;
  }

  // No-op safety (spike pass #5): drop suggestions equal to original.
  const filtered = suggestions
    .filter((s) => s.newSelector !== input.failingSelector)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  logger.info('Self-heal suggestions', {
    testId: input.testId,
    count: filtered.length,
    topConfidence: filtered[0]?.confidence ?? 0,
    costUsd,
  });

  return {
    originalSelector: input.failingSelector,
    suggestions: filtered,
    recommendation: filtered[0] ?? null,
    costUsd,
  };
}

function buildPrompt(input: SelfHealInput): string {
  return [
    'You are a mobile automation locator-healing assistant.',
    'A test failed with NoSuchElement. Suggest top-3 alternative selectors',
    'based on the page source. Each suggestion MUST exist in the page source —',
    'do NOT invent attributes that are absent.',
    '',
    `testId: ${input.testId}`,
    `pageObjectFile: ${input.pageObjectFile}`,
    `failingSelector: ${input.failingSelector}`,
    `errorMessage: ${input.errorMessage}`,
    '',
    'pageSourceSnippet:',
    '```xml',
    input.pageSourceSnippet,
    '```',
    '',
    'Respond with JSON: { suggestions: [{ newSelector, selectorType, confidence (0-1), reasoning }] }',
    'Prefer accessibility-id selectors over xpath. Rank by confidence DESC.',
    'If no plausible alternative, return suggestions: [].',
  ].join('\n');
}
