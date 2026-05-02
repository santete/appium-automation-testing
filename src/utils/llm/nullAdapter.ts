/**
 * NullAdapter — disable LLM, used khi LLM_PROVIDER=none hoặc budget exceeded.
 *
 * Throws `LlmConfigError` ngay khi `suggest()` được gọi để caller fallback
 * rule-only path. Caller cần gating logic (vd. classifier escalator chỉ
 * call adapter khi rule-only ambiguous).
 */
import type { LlmAdapter, LlmSuggestRequest, LlmSuggestResult } from './types';
import { LlmConfigError } from './types';

export class NullLlmAdapter implements LlmAdapter {
  readonly providerId = 'null';

  async suggest<T>(_req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
    throw new LlmConfigError(
      'LLM_PROVIDER=none — adapter no-op. Set LLM_PROVIDER=anthropic|openai|ollama in .env.local + fill LLM_API_KEY/LLM_MODEL để enable.',
    );
  }
}
