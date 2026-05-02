/**
 * Unit tests cho self-heal suggester (M5 Task 4).
 *
 * Cover:
 *  - Happy path: 3 suggestions returned, ranked DESC by confidence.
 *  - Empty suggestions: page source unparseable → empty list.
 *  - Same-as-original filter: drop suggestion equal to failing selector.
 *  - Page source truncation when > 8000 chars.
 *  - LlmInvalidOutputError → bubble (caller handles).
 *  - LlmBudgetExceededError → bubble.
 *  - Cost recorded on tracker.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  suggestLocators,
  type SelfHealInput,
  type LocatorSuggestion,
} from '../../src/utils/selfHeal/suggester';
import { LlmBudgetTracker } from '../../src/utils/llm/budget';
import {
  LlmBudgetExceededError,
  LlmInvalidOutputError,
  type LlmAdapter,
  type LlmSuggestRequest,
  type LlmSuggestResult,
} from '../../src/utils/llm/types';

function makeAdapter(
  payload: { suggestions: LocatorSuggestion[] } | Error,
  costUsd = 0.002,
): LlmAdapter & { lastPrompt?: string } {
  const adapter: LlmAdapter & { lastPrompt?: string } = {
    providerId: 'stub',
    async suggest<T>(req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
      adapter.lastPrompt = req.prompt;
      if (payload instanceof Error) throw payload;
      return {
        output: payload as T,
        tokensIn: 200,
        tokensOut: 100,
        costUsd,
        modelUsed: 'stub-model',
      };
    },
  };
  return adapter;
}

function baseInput(over: Partial<SelfHealInput> = {}): SelfHealInput {
  return {
    testId: 'CartPage > openCart',
    pageObjectFile: 'src/pages/CartPage.ts',
    failingSelector: '~test-Cart',
    pageSourceSnippet:
      '<View resource-id="com.app:id/cart" content-desc="test-CartV2"><Text content-desc="Items"/></View>',
    errorMessage: 'no such element: ~test-Cart',
    ...over,
  };
}

describe('suggestLocators', () => {
  let tmpDir: string;
  let tracker: LlmBudgetTracker;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-heal-test-'));
    tracker = new LlmBudgetTracker({
      statePath: path.join(tmpDir, 'spend.json'),
      budgetMonthlyUsd: 1,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Happy path: returns top-3 sorted DESC by confidence', async () => {
    const adapter = makeAdapter({
      suggestions: [
        {
          newSelector: '~test-CartV2',
          selectorType: 'accessibility-id',
          confidence: 0.95,
          reasoning: 'content-desc renamed v2',
        },
        {
          newSelector: '//View[@resource-id="com.app:id/cart"]',
          selectorType: 'xpath',
          confidence: 0.7,
          reasoning: 'fallback by resource-id',
        },
        {
          newSelector: '~test-Items',
          selectorType: 'accessibility-id',
          confidence: 0.5,
          reasoning: 'sibling element guess',
        },
      ],
    });
    const r = await suggestLocators(baseInput(), { adapter, tracker });
    expect(r.suggestions).to.have.lengthOf(3);
    expect(r.suggestions[0].confidence).to.equal(0.95);
    expect(r.recommendation?.newSelector).to.equal('~test-CartV2');
    expect(r.costUsd).to.equal(0.002);
  });

  it('Empty suggestions → recommendation null', async () => {
    const adapter = makeAdapter({ suggestions: [] });
    const r = await suggestLocators(baseInput(), { adapter, tracker });
    expect(r.suggestions).to.have.lengthOf(0);
    expect(r.recommendation).to.be.null;
  });

  it('Same-as-original filter (no-op safety)', async () => {
    const adapter = makeAdapter({
      suggestions: [
        {
          newSelector: '~test-Cart', // same as input
          selectorType: 'accessibility-id',
          confidence: 0.9,
          reasoning: 'redundant',
        },
        {
          newSelector: '~test-CartV2',
          selectorType: 'accessibility-id',
          confidence: 0.85,
          reasoning: 'real fix',
        },
      ],
    });
    const r = await suggestLocators(baseInput(), { adapter, tracker });
    expect(r.suggestions).to.have.lengthOf(1);
    expect(r.suggestions[0].newSelector).to.equal('~test-CartV2');
  });

  it('Truncate page source > 8000 chars', async () => {
    const adapter = makeAdapter({
      suggestions: [
        {
          newSelector: '~test-X',
          selectorType: 'accessibility-id',
          confidence: 0.8,
          reasoning: 'long source handled',
        },
      ],
    });
    const huge = 'X'.repeat(20000);
    await suggestLocators(baseInput({ pageSourceSnippet: huge }), { adapter, tracker });
    expect(adapter.lastPrompt).to.include('[truncated]');
    expect(adapter.lastPrompt!.length).to.be.lessThan(20000);
  });

  it('LlmInvalidOutputError → bubble', async () => {
    const adapter = makeAdapter(new LlmInvalidOutputError('schema mismatch', '{bad}'));
    let thrown: unknown;
    try {
      await suggestLocators(baseInput(), { adapter, tracker });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmInvalidOutputError);
  });

  it('LlmBudgetExceededError on adapter call → bubble', async () => {
    const adapter = makeAdapter(new LlmBudgetExceededError('cap', 1.5, 1));
    let thrown: unknown;
    try {
      await suggestLocators(baseInput(), { adapter, tracker });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(LlmBudgetExceededError);
  });

  it('Cost recorded on tracker post-success', async () => {
    const adapter = makeAdapter(
      {
        suggestions: [
          {
            newSelector: '~test-X',
            selectorType: 'accessibility-id',
            confidence: 0.9,
            reasoning: 'ok',
          },
        ],
      },
      0.04,
    );
    await suggestLocators(baseInput(), { adapter, tracker });
    const spend = await tracker.getCurrentSpend();
    expect(spend.totalUsd).to.be.closeTo(0.04, 1e-9);
  });
});
