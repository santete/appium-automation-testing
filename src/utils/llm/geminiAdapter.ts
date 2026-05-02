/**
 * Gemini adapter — Google Gemini API qua HTTP fetch (native REST endpoint,
 * không qua OpenAI compat shim).
 *
 * Pricing (2026-04 reference, public Google AI pricing):
 *   - gemini-2.5-flash:      $0.30/1M in + $2.50/1M out
 *   - gemini-2.5-flash-lite: $0.10/1M in + $0.40/1M out
 *   - gemini-2.5-pro:        $1.25/1M in + $10/1M out  (≤200K context tier)
 *
 * Free tier (Google AI Studio key): 15 RPM + ~1M tokens/day cho Flash —
 * đủ cho M5 classifier escalator + self-heal suggester usage hiện tại.
 *
 * Pattern khớp AnthropicAdapter / OpenAIAdapter — caller code identical,
 * chỉ swap factory.
 */
import type { LlmAdapter, LlmSuggestRequest, LlmSuggestResult } from './types';
import { LlmConfigError, LlmInvalidOutputError } from './types';
import { logger } from '../logger';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
}

const DEFAULT_PRICING: Record<string, { inputPerMTokens: number; outputPerMTokens: number }> = {
  'gemini-2.5-flash': { inputPerMTokens: 0.3, outputPerMTokens: 2.5 },
  'gemini-2.5-flash-lite': { inputPerMTokens: 0.1, outputPerMTokens: 0.4 },
  'gemini-2.5-pro': { inputPerMTokens: 1.25, outputPerMTokens: 10 },
};

export interface GeminiAdapterOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pricing?: { inputPerMTokens: number; outputPerMTokens: number };
}

export class GeminiAdapter implements LlmAdapter {
  readonly providerId = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pricing: { inputPerMTokens: number; outputPerMTokens: number };

  constructor(opts: GeminiAdapterOptions) {
    if (!opts.apiKey) throw new LlmConfigError('GeminiAdapter: apiKey required');
    if (!opts.model) throw new LlmConfigError('GeminiAdapter: model required');
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://generativelanguage.googleapis.com';
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.pricing = opts.pricing ??
      DEFAULT_PRICING[opts.model] ?? { inputPerMTokens: 0.3, outputPerMTokens: 2.5 };
  }

  async suggest<T>(req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
    const url = `${this.baseUrl}/v1beta/models/${this.model}:generateContent`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: 'Respond with valid JSON only. No markdown, no commentary.' }],
      },
      generationConfig: {
        temperature: req.temperature ?? 0,
        maxOutputTokens: req.maxOutputTokens ?? 1024,
        responseMimeType: 'application/json',
      },
    };

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as GeminiGenerateResponse;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new LlmInvalidOutputError(
        `Gemini response không phải JSON: ${(e as Error).message}`,
        text,
      );
    }

    const validation = req.outputSchema.safeParse(parsed);
    if (!validation.success) {
      throw new LlmInvalidOutputError(
        `Gemini output không khớp schema: ${validation.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`,
        text,
      );
    }

    const tokensIn = json.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = json.usageMetadata?.candidatesTokenCount ?? 0;
    const modelUsed = json.modelVersion ?? this.model;
    const costUsd = this.computeCost(tokensIn, tokensOut);

    logger.info('Gemini adapter call', {
      model: modelUsed,
      tokensIn,
      tokensOut,
      costUsd,
    });

    return {
      output: validation.data,
      tokensIn,
      tokensOut,
      costUsd,
      modelUsed,
    };
  }

  private computeCost(tokensIn: number, tokensOut: number): number {
    return (
      (tokensIn / 1_000_000) * this.pricing.inputPerMTokens +
      (tokensOut / 1_000_000) * this.pricing.outputPerMTokens
    );
  }
}
