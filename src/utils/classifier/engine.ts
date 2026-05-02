/**
 * Classifier engine — apply rules in priority order, first match wins.
 *
 * Plan ref: M5 Task 1.
 *
 * Caller pattern (Task 2 escalator):
 *   const classification = classify(input);
 *   if (classification.category === 'UNKNOWN' || classification.confidence < 0.85) {
 *     // escalate to LLM adapter (Task 2)
 *   }
 *   await kbAppender.append(classification); // Task 7
 *   await router.route(classification); // M4 hooks consume
 */
import type { ClassifierInput, FailureClassification } from './types';
import { RULES, unknownClassification } from './rules';
import { logger } from '../logger';

export function classify(input: ClassifierInput): FailureClassification {
  for (const rule of RULES) {
    if (rule.matches(input)) {
      const result = rule.classify(input);
      logger.debug('classifier matched', { testId: input.testId, rule: rule.name });
      return {
        ...result,
        testId: input.testId,
        matchedRule: rule.name,
      };
    }
  }
  logger.debug('classifier no-match → UNKNOWN', { testId: input.testId });
  return unknownClassification(input);
}
