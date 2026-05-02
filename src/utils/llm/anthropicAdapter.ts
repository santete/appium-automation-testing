/**
 * Anthropic adapter — Claude API qua HTTP fetch (không bind SDK).
 *
 * Pricing (2026-04 reference):
 *   - claude-sonnet-4-6: $3/1M in + $15/1M out
 *   - claude-haiku-4-5:  $1/1M in + $5/1M out
 *   - claude-opus-4-7:   $15/1M in + $75/1M out
 *
 * Pricing table extensible — không hardcode list, đọc từ env override
 * `LLM_PRICING_INPUT_PER_MTOKEN` + `LLM_PRICING_OUTPUT_PER_MTOKEN` nếu set.
 *
 * Caller responsibility:
 *   - LlmBudgetTracker.record(result.costUsd) sau mỗi call success.
 *   - Catch LlmInvalidOutputError → fallback rule-only.
 */
import type { LlmAdapter, LlmSuggestRequest, LlmSuggestResult } from './types';
import { LlmConfigError, LlmInvalidOutputError } from './types';
import { logger } from '../logger';

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

const DEFAULT_PRICING: Record<string, { inputPerMTokens: number; outputPerMTokens: number }> = {
  'claude-sonnet-4-6': { inputPerMTokens: 3, outputPerMTokens: 15 },
  'claude-haiku-4-5-20251001': { inputPerMTokens: 1, outputPerMTokens: 5 },
  'claude-opus-4-7': { inputPerMTokens: 15, outputPerMTokens: 75 },
};

export interface AnthropicAdapterOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Override fetch cho unit test. */
  fetchImpl?: typeof fetch;
  /** Override pricing cho test hoặc model mới chưa có trong DEFAULT_PRICING. */
  pricing?: { inputPerMTokens: number; outputPerMTokens: number };
}

export class AnthropicAdapter implements LlmAdapter {
  readonly providerId = 'anthropic';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pricing: { inputPerMTokens: number; outputPerMTokens: number };

  constructor(opts: AnthropicAdapterOptions) {
    if (!opts.apiKey) throw new LlmConfigError('AnthropicAdapter: apiKey required');
    if (!opts.model) throw new LlmConfigError('AnthropicAdapter: model required');
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.pricing = opts.pricing ??
      DEFAULT_PRICING[opts.model] ?? { inputPerMTokens: 3, outputPerMTokens: 15 };
  }

  async suggest<T>(req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
    const systemPrompt = `Respond with valid JSON only. No markdown, no commentary.`;
    const url = `${this.baseUrl}/v1/messages`;

    const body = {
      model: this.model,
      max_tokens: req.maxOutputTokens ?? 1024,
      temperature: req.temperature ?? 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: req.prompt }],
    };

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as AnthropicMessageResponse;
    const text = json.content?.[0]?.text ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new LlmInvalidOutputError(
        `Anthropic response không phải JSON: ${(e as Error).message}`,
        text,
      );
    }

    const validation = req.outputSchema.safeParse(parsed);
    if (!validation.success) {
      throw new LlmInvalidOutputError(
        `Anthropic output không khớp schema: ${validation.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`,
        text,
      );
    }

    const costUsd = this.computeCost(json.usage.input_tokens, json.usage.output_tokens);
    logger.info('Anthropic adapter call', {
      model: json.model,
      tokensIn: json.usage.input_tokens,
      tokensOut: json.usage.output_tokens,
      costUsd,
    });

    return {
      output: validation.data,
      tokensIn: json.usage.input_tokens,
      tokensOut: json.usage.output_tokens,
      costUsd,
      modelUsed: json.model,
    };
  }

  private computeCost(tokensIn: number, tokensOut: number): number {
    return (
      (tokensIn / 1_000_000) * this.pricing.inputPerMTokens +
      (tokensOut / 1_000_000) * this.pricing.outputPerMTokens
    );
  }
}
