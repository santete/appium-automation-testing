/**
 * OpenAI adapter — Chat Completions API qua HTTP fetch.
 *
 * Pricing (2026-04 reference):
 *   - gpt-4o-mini: $0.15/1M in + $0.60/1M out
 *   - gpt-4o:      $2.50/1M in + $10/1M out
 *
 * Pattern khớp AnthropicAdapter — caller code identical, chỉ swap factory.
 */
import type { LlmAdapter, LlmSuggestRequest, LlmSuggestResult } from './types';
import { LlmConfigError, LlmInvalidOutputError } from './types';
import { logger } from '../logger';

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

const DEFAULT_PRICING: Record<string, { inputPerMTokens: number; outputPerMTokens: number }> = {
  'gpt-4o-mini': { inputPerMTokens: 0.15, outputPerMTokens: 0.6 },
  'gpt-4o': { inputPerMTokens: 2.5, outputPerMTokens: 10 },
};

export interface OpenAIAdapterOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pricing?: { inputPerMTokens: number; outputPerMTokens: number };
}

export class OpenAIAdapter implements LlmAdapter {
  readonly providerId = 'openai';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pricing: { inputPerMTokens: number; outputPerMTokens: number };

  constructor(opts: OpenAIAdapterOptions) {
    if (!opts.apiKey) throw new LlmConfigError('OpenAIAdapter: apiKey required');
    if (!opts.model) throw new LlmConfigError('OpenAIAdapter: model required');
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com';
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.pricing = opts.pricing ??
      DEFAULT_PRICING[opts.model] ?? { inputPerMTokens: 0.15, outputPerMTokens: 0.6 };
  }

  async suggest<T>(req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const body = {
      model: this.model,
      max_tokens: req.maxOutputTokens ?? 1024,
      temperature: req.temperature ?? 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Respond with valid JSON only.' },
        { role: 'user', content: req.prompt },
      ],
    };

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as OpenAIChatResponse;
    const text = json.choices?.[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new LlmInvalidOutputError(
        `OpenAI response không phải JSON: ${(e as Error).message}`,
        text,
      );
    }

    const validation = req.outputSchema.safeParse(parsed);
    if (!validation.success) {
      throw new LlmInvalidOutputError(
        `OpenAI output không khớp schema: ${validation.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`,
        text,
      );
    }

    const costUsd = this.computeCost(json.usage.prompt_tokens, json.usage.completion_tokens);
    logger.info('OpenAI adapter call', {
      model: json.model,
      tokensIn: json.usage.prompt_tokens,
      tokensOut: json.usage.completion_tokens,
      costUsd,
    });

    return {
      output: validation.data,
      tokensIn: json.usage.prompt_tokens,
      tokensOut: json.usage.completion_tokens,
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
