/**
 * Unit tests cho LLM adapter scaffold.
 *
 * Plan ref: M5 Task 0.
 *
 * Cover:
 *  - LlmBudgetTracker: empty state, accept under budget, throw over budget,
 *    monthly auto-reset, malformed state file → reset, getCurrentSpend.
 *  - NullLlmAdapter: throw LlmConfigError on suggest.
 *  - AnthropicAdapter: happy path (mocked fetch), JSON parse fail, schema fail,
 *    HTTP error, cost computation per-MTokens.
 *  - OpenAIAdapter: same pattern.
 *  - OllamaAdapter: same pattern + costUsd=0 verified.
 *  - createLlmAdapter factory: each provider routing, missing apiKey/model
 *    throws LlmConfigError.
 *
 * Mock fetch implementation: caller injects `fetchImpl` constructor option,
 * KHÔNG monkeypatch global fetch — keep test isolated.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import {
  LlmBudgetExceededError,
  LlmConfigError,
  LlmInvalidOutputError,
} from '../../src/utils/llm/types';
import { LlmBudgetTracker } from '../../src/utils/llm/budget';
import { NullLlmAdapter } from '../../src/utils/llm/nullAdapter';
import { AnthropicAdapter } from '../../src/utils/llm/anthropicAdapter';
import { OpenAIAdapter } from '../../src/utils/llm/openaiAdapter';
import { OllamaAdapter } from '../../src/utils/llm/ollamaAdapter';
import { GeminiAdapter } from '../../src/utils/llm/geminiAdapter';
import { createLlmAdapter } from '../../src/utils/llm/factory';
import type { Env } from '../../src/config';

const SAMPLE_SCHEMA = z.object({ category: z.string(), confidence: z.number() });
type SampleOut = z.infer<typeof SAMPLE_SCHEMA>;

function makeMockFetch(
  status: number,
  responseBody: unknown,
): { fetchImpl: typeof fetch; calls: Array<{ url: string; init: RequestInit | undefined }> } {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () =>
        typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
      json: async () =>
        typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody,
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('LlmBudgetTracker', () => {
  let tmpDir: string;
  let statePath: string;
  const fixedNow = () => new Date('2026-04-28T12:00:00Z');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-budget-test-'));
    statePath = path.join(tmpDir, 'spend.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('getCurrentSpend: state missing → totalUsd=0 + current month', async () => {
    const t = new LlmBudgetTracker({ statePath, budgetMonthlyUsd: 20, now: fixedNow });
    const s = await t.getCurrentSpend();
    expect(s.totalUsd).to.equal(0);
    expect(s.month).to.equal('2026-04');
    expect(s.budgetUsd).to.equal(20);
  });

  it('record: under budget → write state', async () => {
    const t = new LlmBudgetTracker({ statePath, budgetMonthlyUsd: 20, now: fixedNow });
    await t.record(0.0123);
    const s = await t.getCurrentSpend();
    expect(s.totalUsd).to.be.closeTo(0.0123, 1e-9);
  });

  it('record: cumulative under budget', async () => {
    const t = new LlmBudgetTracker({ statePath, budgetMonthlyUsd: 1, now: fixedNow });
    await t.record(0.3);
    await t.record(0.4);
    const s = await t.getCurrentSpend();
    expect(s.totalUsd).to.be.closeTo(0.7, 1e-9);
  });

  it('record: over budget → throw LlmBudgetExceededError, không persist', async () => {
    const t = new LlmBudgetTracker({ statePath, budgetMonthlyUsd: 1, now: fixedNow });
    await t.record(0.8);
    let thrown: unknown;
    try {
      await t.record(0.5); // 0.8 + 0.5 = 1.3 > 1
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmBudgetExceededError);
    const s = await t.getCurrentSpend();
    expect(s.totalUsd).to.be.closeTo(0.8, 1e-9); // không tăng
  });

  it('record: negative cost → throw', async () => {
    const t = new LlmBudgetTracker({ statePath, budgetMonthlyUsd: 1, now: fixedNow });
    let thrown: unknown;
    try {
      await t.record(-0.1);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(Error);
  });

  it('record: month rolled over → auto-reset totalUsd', async () => {
    let now = new Date('2026-04-28T12:00:00Z');
    const t = new LlmBudgetTracker({
      statePath,
      budgetMonthlyUsd: 1,
      now: () => now,
    });
    await t.record(0.9);
    expect((await t.getCurrentSpend()).totalUsd).to.be.closeTo(0.9, 1e-9);
    // tháng kế
    now = new Date('2026-05-01T00:00:00Z');
    await t.record(0.5); // không vượt budget vì đã reset
    const s = await t.getCurrentSpend();
    expect(s.month).to.equal('2026-05');
    expect(s.totalUsd).to.be.closeTo(0.5, 1e-9);
  });

  it('record: malformed state file → treat as empty (reset)', async () => {
    fs.writeFileSync(statePath, '{not-json');
    const t = new LlmBudgetTracker({ statePath, budgetMonthlyUsd: 1, now: fixedNow });
    await t.record(0.2);
    const s = await t.getCurrentSpend();
    expect(s.totalUsd).to.be.closeTo(0.2, 1e-9);
  });
});

describe('NullLlmAdapter', () => {
  it('suggest: throw LlmConfigError', async () => {
    const a = new NullLlmAdapter();
    expect(a.providerId).to.equal('null');
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmConfigError);
  });
});

describe('AnthropicAdapter', () => {
  function happyResponse(json: SampleOut, tokensIn = 100, tokensOut = 50) {
    return {
      content: [{ type: 'text', text: JSON.stringify(json) }],
      usage: { input_tokens: tokensIn, output_tokens: tokensOut },
      model: 'claude-sonnet-4-6',
    };
  }

  it('constructor: missing apiKey → throw', () => {
    expect(() => new AnthropicAdapter({ apiKey: '', model: 'm' })).to.throw(LlmConfigError);
  });

  it('constructor: missing model → throw', () => {
    expect(() => new AnthropicAdapter({ apiKey: 'k', model: '' })).to.throw(LlmConfigError);
  });

  it('suggest: happy path → return parsed output + cost', async () => {
    const { fetchImpl, calls } = makeMockFetch(
      200,
      happyResponse({ category: 'flaky', confidence: 0.8 }, 1_000_000, 500_000),
    );
    const a = new AnthropicAdapter({
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      fetchImpl,
    });
    const r = await a.suggest({ prompt: 'classify', outputSchema: SAMPLE_SCHEMA });
    expect(r.output.category).to.equal('flaky');
    expect(r.tokensIn).to.equal(1_000_000);
    expect(r.tokensOut).to.equal(500_000);
    // 1M*$3 + 0.5M*$15 = 3 + 7.5 = 10.5
    expect(r.costUsd).to.be.closeTo(10.5, 1e-9);
    expect(r.modelUsed).to.equal('claude-sonnet-4-6');
    expect(calls).to.have.lengthOf(1);
    expect(calls[0].url).to.include('/v1/messages');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['x-api-key']).to.equal('sk-test');
    expect(headers['anthropic-version']).to.equal('2023-06-01');
  });

  it('suggest: HTTP non-2xx → throw with status', async () => {
    const { fetchImpl } = makeMockFetch(401, 'unauthorized');
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-sonnet-4-6', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(Error);
    expect((thrown as Error).message).to.match(/Anthropic API 401/);
  });

  it('suggest: response không phải JSON → LlmInvalidOutputError', async () => {
    const { fetchImpl } = makeMockFetch(200, {
      content: [{ type: 'text', text: 'not-json{' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-4-6',
    });
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-sonnet-4-6', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
  });

  it('suggest: schema mismatch → LlmInvalidOutputError với rawOutput', async () => {
    const { fetchImpl } = makeMockFetch(
      200,
      happyResponse({ category: 'x', confidence: 'bad' as unknown as number }),
    );
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-sonnet-4-6', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
    expect((thrown as LlmInvalidOutputError).rawOutput).to.include('confidence');
  });

  it('suggest: pricing override applied', async () => {
    const { fetchImpl } = makeMockFetch(
      200,
      happyResponse({ category: 'x', confidence: 1 }, 1_000_000, 1_000_000),
    );
    const a = new AnthropicAdapter({
      apiKey: 'k',
      model: 'claude-haiku-4-5-20251001',
      fetchImpl,
      pricing: { inputPerMTokens: 1, outputPerMTokens: 5 },
    });
    const r = await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    expect(r.costUsd).to.be.closeTo(6, 1e-9); // 1 + 5
  });
});

describe('OpenAIAdapter', () => {
  function happyResponse(json: SampleOut, tokensIn = 100, tokensOut = 50) {
    return {
      choices: [{ message: { content: JSON.stringify(json) } }],
      usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut },
      model: 'gpt-4o-mini',
    };
  }

  it('constructor: missing apiKey → throw', () => {
    expect(() => new OpenAIAdapter({ apiKey: '', model: 'm' })).to.throw(LlmConfigError);
  });

  it('suggest: happy path with default pricing (gpt-4o-mini)', async () => {
    const { fetchImpl, calls } = makeMockFetch(
      200,
      happyResponse({ category: 'env', confidence: 0.7 }, 1_000_000, 1_000_000),
    );
    const a = new OpenAIAdapter({ apiKey: 'sk-test', model: 'gpt-4o-mini', fetchImpl });
    const r = await a.suggest({ prompt: 'classify', outputSchema: SAMPLE_SCHEMA });
    expect(r.output.category).to.equal('env');
    // 0.15 + 0.6 = 0.75
    expect(r.costUsd).to.be.closeTo(0.75, 1e-9);
    expect(calls[0].url).to.include('/v1/chat/completions');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).to.equal('Bearer sk-test');
  });

  it('suggest: HTTP error → throw', async () => {
    const { fetchImpl } = makeMockFetch(500, 'server error');
    const a = new OpenAIAdapter({ apiKey: 'k', model: 'gpt-4o-mini', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).to.match(/OpenAI API 500/);
  });

  it('suggest: invalid JSON → LlmInvalidOutputError', async () => {
    const { fetchImpl } = makeMockFetch(200, {
      choices: [{ message: { content: '{bad json' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: 'gpt-4o-mini',
    });
    const a = new OpenAIAdapter({ apiKey: 'k', model: 'gpt-4o-mini', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
  });

  it('suggest: schema fail → LlmInvalidOutputError', async () => {
    const { fetchImpl } = makeMockFetch(
      200,
      happyResponse({ category: 'x', confidence: 'oops' as unknown as number }),
    );
    const a = new OpenAIAdapter({ apiKey: 'k', model: 'gpt-4o-mini', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
  });
});

describe('OllamaAdapter', () => {
  function happyResponse(json: SampleOut) {
    return {
      response: JSON.stringify(json),
      prompt_eval_count: 200,
      eval_count: 100,
      model: 'llama3.1:8b',
    };
  }

  it('constructor: missing model → throw', () => {
    expect(() => new OllamaAdapter({ model: '' })).to.throw(LlmConfigError);
  });

  it('suggest: happy path → costUsd=0, default baseUrl localhost:11434', async () => {
    const { fetchImpl, calls } = makeMockFetch(
      200,
      happyResponse({ category: 'app', confidence: 0.9 }),
    );
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    const r = await a.suggest({ prompt: 'classify', outputSchema: SAMPLE_SCHEMA });
    expect(r.output.category).to.equal('app');
    expect(r.costUsd).to.equal(0);
    expect(r.tokensIn).to.equal(200);
    expect(r.tokensOut).to.equal(100);
    expect(calls[0].url).to.equal('http://localhost:11434/api/generate');
  });

  it('suggest: custom baseUrl honored', async () => {
    const { fetchImpl, calls } = makeMockFetch(
      200,
      happyResponse({ category: 'x', confidence: 1 }),
    );
    const a = new OllamaAdapter({
      model: 'llama3.1:8b',
      baseUrl: 'http://gpu-box:11434',
      fetchImpl,
    });
    await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    expect(calls[0].url).to.equal('http://gpu-box:11434/api/generate');
  });

  it('suggest: HTTP error → throw', async () => {
    const { fetchImpl } = makeMockFetch(503, 'down');
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).to.match(/Ollama API 503/);
  });

  it('suggest: invalid JSON in response → LlmInvalidOutputError', async () => {
    const { fetchImpl } = makeMockFetch(200, {
      response: 'not-json{',
      prompt_eval_count: 1,
      eval_count: 1,
      model: 'llama3.1:8b',
    });
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
  });
});

describe('GeminiAdapter', () => {
  function happyResponse(json: SampleOut, tokensIn = 100, tokensOut = 50) {
    return {
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(json) }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: tokensIn,
        candidatesTokenCount: tokensOut,
        totalTokenCount: tokensIn + tokensOut,
      },
      modelVersion: 'gemini-2.5-flash',
    };
  }

  it('constructor: missing apiKey → throw', () => {
    expect(() => new GeminiAdapter({ apiKey: '', model: 'm' })).to.throw(LlmConfigError);
  });

  it('constructor: missing model → throw', () => {
    expect(() => new GeminiAdapter({ apiKey: 'k', model: '' })).to.throw(LlmConfigError);
  });

  it('suggest: happy path with default pricing (gemini-2.5-flash)', async () => {
    const { fetchImpl, calls } = makeMockFetch(
      200,
      happyResponse({ category: 'flaky', confidence: 0.85 }, 1_000_000, 1_000_000),
    );
    const a = new GeminiAdapter({
      apiKey: 'AIza-test',
      model: 'gemini-2.5-flash',
      fetchImpl,
    });
    const r = await a.suggest({ prompt: 'classify', outputSchema: SAMPLE_SCHEMA });
    expect(r.output.category).to.equal('flaky');
    expect(r.tokensIn).to.equal(1_000_000);
    expect(r.tokensOut).to.equal(1_000_000);
    // 1M*$0.30 + 1M*$2.50 = 0.30 + 2.50 = 2.80
    expect(r.costUsd).to.be.closeTo(2.8, 1e-9);
    expect(r.modelUsed).to.equal('gemini-2.5-flash');
    expect(calls).to.have.lengthOf(1);
    expect(calls[0].url).to.include('/v1beta/models/gemini-2.5-flash:generateContent');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).to.equal('AIza-test');
  });

  it('suggest: HTTP non-2xx → throw with status', async () => {
    const { fetchImpl } = makeMockFetch(403, 'permission denied');
    const a = new GeminiAdapter({ apiKey: 'k', model: 'gemini-2.5-flash', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).to.match(/Gemini API 403/);
  });

  it('suggest: invalid JSON → LlmInvalidOutputError', async () => {
    const { fetchImpl } = makeMockFetch(200, {
      candidates: [{ content: { parts: [{ text: 'not-json{' }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      modelVersion: 'gemini-2.5-flash',
    });
    const a = new GeminiAdapter({ apiKey: 'k', model: 'gemini-2.5-flash', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
  });

  it('suggest: schema mismatch → LlmInvalidOutputError với rawOutput', async () => {
    const { fetchImpl } = makeMockFetch(
      200,
      happyResponse({ category: 'x', confidence: 'bad' as unknown as number }),
    );
    const a = new GeminiAdapter({ apiKey: 'k', model: 'gemini-2.5-flash', fetchImpl });
    let thrown: unknown;
    try {
      await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
    expect((thrown as LlmInvalidOutputError).rawOutput).to.include('confidence');
  });

  it('suggest: pricing override applied (flash-lite)', async () => {
    const { fetchImpl } = makeMockFetch(
      200,
      happyResponse({ category: 'x', confidence: 1 }, 1_000_000, 1_000_000),
    );
    const a = new GeminiAdapter({
      apiKey: 'k',
      model: 'gemini-2.5-flash-lite',
      fetchImpl,
    });
    const r = await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    // flash-lite default: 0.10 + 0.40 = 0.50
    expect(r.costUsd).to.be.closeTo(0.5, 1e-9);
  });

  it('suggest: missing usageMetadata → tokensIn/Out = 0, costUsd = 0', async () => {
    const { fetchImpl } = makeMockFetch(200, {
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify({ category: 'x', confidence: 0.5 }) }] },
        },
      ],
      modelVersion: 'gemini-2.5-flash',
    });
    const a = new GeminiAdapter({ apiKey: 'k', model: 'gemini-2.5-flash', fetchImpl });
    const r = await a.suggest({ prompt: 'x', outputSchema: SAMPLE_SCHEMA });
    expect(r.tokensIn).to.equal(0);
    expect(r.tokensOut).to.equal(0);
    expect(r.costUsd).to.equal(0);
  });
});

describe('createLlmAdapter factory', () => {
  function envBase(over: Partial<Env>): Env {
    return {
      ENV_PROFILE: 'local',
      ANDROID_DEVICE_NAME: 'x',
      ANDROID_PLATFORM_VERSION: '14',
      APP_PATH: 'x',
      DEFAULT_WAIT_TIMEOUT: 10000,
      DEFAULT_WAIT_INTERVAL: 500,
      ACCOUNT_POOL_CONFIG_PATH: 'x',
      ACCOUNT_POOL_STATE_PATH: 'x',
      NETWORK_SIM_DEFAULT: 'full',
      ALLOW_NETWORK_INTEGRATION: false,
      LLM_PROVIDER: 'none',
      LLM_BUDGET_MONTHLY_USD: 20,
      LLM_SPEND_STATE_PATH: './tmp/llm-spend.json',
      ...over,
    } as Env;
  }

  it('LLM_PROVIDER=none → NullLlmAdapter', () => {
    const a = createLlmAdapter(envBase({ LLM_PROVIDER: 'none' }));
    expect(a.providerId).to.equal('null');
  });

  it('LLM_PROVIDER=anthropic + missing key → throw LlmConfigError', () => {
    expect(() =>
      createLlmAdapter(envBase({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'claude-sonnet-4-6' })),
    ).to.throw(LlmConfigError);
  });

  it('LLM_PROVIDER=anthropic + missing model → throw LlmConfigError', () => {
    expect(() =>
      createLlmAdapter(envBase({ LLM_PROVIDER: 'anthropic', LLM_API_KEY: 'k' })),
    ).to.throw(LlmConfigError);
  });

  it('LLM_PROVIDER=anthropic + full → AnthropicAdapter', () => {
    const a = createLlmAdapter(
      envBase({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'k',
        LLM_MODEL: 'claude-sonnet-4-6',
      }),
    );
    expect(a.providerId).to.equal('anthropic');
  });

  it('LLM_PROVIDER=openai + missing key → throw LlmConfigError', () => {
    expect(() =>
      createLlmAdapter(envBase({ LLM_PROVIDER: 'openai', LLM_MODEL: 'gpt-4o-mini' })),
    ).to.throw(LlmConfigError);
  });

  it('LLM_PROVIDER=openai + full → OpenAIAdapter', () => {
    const a = createLlmAdapter(
      envBase({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'k', LLM_MODEL: 'gpt-4o-mini' }),
    );
    expect(a.providerId).to.equal('openai');
  });

  it('LLM_PROVIDER=ollama + missing model → throw LlmConfigError', () => {
    expect(() => createLlmAdapter(envBase({ LLM_PROVIDER: 'ollama' }))).to.throw(LlmConfigError);
  });

  it('LLM_PROVIDER=ollama + model only → OllamaAdapter (no key required)', () => {
    const a = createLlmAdapter(envBase({ LLM_PROVIDER: 'ollama', LLM_MODEL: 'llama3.1:8b' }));
    expect(a.providerId).to.equal('ollama');
  });

  it('LLM_PROVIDER=gemini + missing key → throw LlmConfigError', () => {
    expect(() =>
      createLlmAdapter(envBase({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'gemini-2.5-flash' })),
    ).to.throw(LlmConfigError);
  });

  it('LLM_PROVIDER=gemini + missing model → throw LlmConfigError', () => {
    expect(() => createLlmAdapter(envBase({ LLM_PROVIDER: 'gemini', LLM_API_KEY: 'k' }))).to.throw(
      LlmConfigError,
    );
  });

  it('LLM_PROVIDER=gemini + full → GeminiAdapter', () => {
    const a = createLlmAdapter(
      envBase({ LLM_PROVIDER: 'gemini', LLM_API_KEY: 'k', LLM_MODEL: 'gemini-2.5-flash' }),
    );
    expect(a.providerId).to.equal('gemini');
  });
});
