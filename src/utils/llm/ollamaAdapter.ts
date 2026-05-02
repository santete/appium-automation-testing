/**
 * Ollama adapter — local LLM server (zero API cost).
 *
 * Default base URL: http://localhost:11434
 * Cost: $0 (local compute) — `costUsd = 0` luôn → budget tracker no-op.
 *
 * Caller cần Ollama daemon chạy + model đã pull (`ollama pull llama3.1:8b`).
 */
import type { LlmAdapter, LlmSuggestRequest, LlmSuggestResult } from './types';
import { LlmConfigError, LlmInvalidOutputError } from './types';
import { logger } from '../logger';

interface OllamaResponse {
  response: string;
  prompt_eval_count?: number;
  eval_count?: number;
  model: string;
}

export interface OllamaAdapterOptions {
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class OllamaAdapter implements LlmAdapter {
  readonly providerId = 'ollama';
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OllamaAdapterOptions) {
    if (!opts.model) throw new LlmConfigError('OllamaAdapter: model required');
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'http://localhost:11434';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async suggest<T>(req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
    const url = `${this.baseUrl}/api/generate`;
    const body = {
      model: this.model,
      prompt: `${req.prompt}\n\nRespond with valid JSON only. No markdown, no commentary.`,
      stream: false,
      format: 'json',
      options: {
        temperature: req.temperature ?? 0,
        num_predict: req.maxOutputTokens ?? 1024,
      },
    };

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as OllamaResponse;
    const text = json.response ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new LlmInvalidOutputError(
        `Ollama response không phải JSON: ${(e as Error).message}`,
        text,
      );
    }

    const validation = req.outputSchema.safeParse(parsed);
    if (!validation.success) {
      throw new LlmInvalidOutputError(
        `Ollama output không khớp schema: ${validation.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`,
        text,
      );
    }

    const tokensIn = json.prompt_eval_count ?? 0;
    const tokensOut = json.eval_count ?? 0;
    logger.info('Ollama adapter call', {
      model: json.model,
      tokensIn,
      tokensOut,
      costUsd: 0,
    });

    return {
      output: validation.data,
      tokensIn,
      tokensOut,
      costUsd: 0,
      modelUsed: json.model,
    };
  }
}
