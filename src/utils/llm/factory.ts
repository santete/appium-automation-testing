/**
 * LLM factory — chọn adapter theo `LLM_PROVIDER` env. Lazy-load adapters
 * để chỉ instantiate provider được chosen (giảm dependency surface khi
 * provider=none).
 *
 * Caller pattern:
 *   const adapter = createLlmAdapter(env);
 *   const tracker = new LlmBudgetTracker({ ... });
 *   try {
 *     const result = await adapter.suggest(req);
 *     await tracker.record(result.costUsd);
 *     return result.output;
 *   } catch (e) {
 *     if (e instanceof LlmBudgetExceededError) // fallback rule-only
 *     if (e instanceof LlmConfigError) // fallback rule-only
 *     if (e instanceof LlmInvalidOutputError) // fallback rule-only
 *     throw e; // unexpected error → bubble
 *   }
 */
import type { Env } from '../../config';
import type { LlmAdapter } from './types';
import { LlmConfigError } from './types';
import { NullLlmAdapter } from './nullAdapter';
import { AnthropicAdapter } from './anthropicAdapter';
import { OpenAIAdapter } from './openaiAdapter';
import { OllamaAdapter } from './ollamaAdapter';
import { GeminiAdapter } from './geminiAdapter';

export function createLlmAdapter(env: Env): LlmAdapter {
  switch (env.LLM_PROVIDER) {
    case 'none':
      return new NullLlmAdapter();

    case 'anthropic':
      if (!env.LLM_API_KEY) {
        throw new LlmConfigError('LLM_PROVIDER=anthropic nhưng LLM_API_KEY rỗng');
      }
      if (!env.LLM_MODEL) {
        throw new LlmConfigError(
          'LLM_PROVIDER=anthropic nhưng LLM_MODEL rỗng (vd. claude-sonnet-4-6)',
        );
      }
      return new AnthropicAdapter({
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
        baseUrl: env.LLM_BASE_URL,
      });

    case 'openai':
      if (!env.LLM_API_KEY) {
        throw new LlmConfigError('LLM_PROVIDER=openai nhưng LLM_API_KEY rỗng');
      }
      if (!env.LLM_MODEL) {
        throw new LlmConfigError('LLM_PROVIDER=openai nhưng LLM_MODEL rỗng (vd. gpt-4o-mini)');
      }
      return new OpenAIAdapter({
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
        baseUrl: env.LLM_BASE_URL,
      });

    case 'gemini':
      if (!env.LLM_API_KEY) {
        throw new LlmConfigError('LLM_PROVIDER=gemini nhưng LLM_API_KEY rỗng');
      }
      if (!env.LLM_MODEL) {
        throw new LlmConfigError('LLM_PROVIDER=gemini nhưng LLM_MODEL rỗng (vd. gemini-2.5-flash)');
      }
      return new GeminiAdapter({
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
        baseUrl: env.LLM_BASE_URL,
      });

    case 'ollama':
      if (!env.LLM_MODEL) {
        throw new LlmConfigError('LLM_PROVIDER=ollama nhưng LLM_MODEL rỗng (vd. llama3.1:8b)');
      }
      return new OllamaAdapter({
        model: env.LLM_MODEL,
        baseUrl: env.LLM_BASE_URL,
      });
  }
}
