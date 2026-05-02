/**
 * LLM adapter contract — provider-agnostic.
 *
 * M5 Decision 2 sign-off 2026-04-28: hardcode provider/model trong code →
 * blocked nếu Phuc chưa chốt key. Adapter pattern (M2 DI checker pattern
 * decision row 20) giữ caller (classifier escalator + self-heal suggester)
 * không phụ thuộc vendor.
 *
 * Contract:
 *   - `suggest()` đồng bộ trả về structured output + cost metadata.
 *   - Adapter handle retry, timeout, JSON-mode parse.
 *   - Caller chịu trách nhiệm budget gate (LlmBudgetTracker).
 *
 * Thread/process safety: adapter stateless ngoài budget tracker file lock.
 */
import { z } from 'zod';

export interface LlmSuggestRequest<T> {
  /** System + user prompt as plain text. Caller đảm bảo không leak PII vào prompt. */
  prompt: string;

  /**
   * Zod schema mô tả structured output expected. Adapter sẽ instruct model
   * trả JSON đúng schema; parse fail → throw `LlmInvalidOutputError`.
   */
  outputSchema: z.ZodType<T>;

  /** Soft cap tokens output (model-specific limit còn ràng buộc cứng). */
  maxOutputTokens?: number;

  /** Temperature 0-1; default 0 cho deterministic structured task. */
  temperature?: number;
}

export interface LlmSuggestResult<T> {
  output: T;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  /** Provider model id thực tế đã call (để log/audit). */
  modelUsed: string;
}

export interface LlmAdapter {
  /** Identifier: 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'null'. */
  readonly providerId: string;

  suggest<T>(req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>>;
}

/**
 * Thrown khi adapter parse model output không khớp `outputSchema`. Caller
 * fallback rule-only.
 */
export class LlmInvalidOutputError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
  ) {
    super(message);
    this.name = 'LlmInvalidOutputError';
  }
}

/**
 * Thrown khi monthly budget exceeded. Caller fallback `nullAdapter` cho
 * phần còn lại của tháng.
 */
export class LlmBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly currentSpendUsd: number,
    public readonly budgetUsd: number,
  ) {
    super(message);
    this.name = 'LlmBudgetExceededError';
  }
}

/**
 * Thrown khi config thiếu required field cho provider chosen
 * (vd. LLM_PROVIDER=anthropic nhưng LLM_API_KEY rỗng).
 */
export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigError';
  }
}
