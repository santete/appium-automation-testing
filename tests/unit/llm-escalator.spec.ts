/**
 * Unit tests cho LLM escalator (M5 Task 2).
 *
 * Cover:
 *  - shouldEscalate: UNKNOWN → true; confidence < threshold → true; else false.
 *  - escalateIfNeeded: high-confidence rule classification → no LLM call.
 *  - escalateIfNeeded: UNKNOWN → call adapter, upgrade classification, record cost.
 *  - escalateIfNeeded: budget exceeded → fallback initial.
 *  - escalateIfNeeded: LlmInvalidOutputError → fallback initial.
 *  - escalateIfNeeded: LlmConfigError → fallback initial.
 *  - escalateIfNeeded: routeTo + assignTo + priority derived from category.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  shouldEscalate,
  escalateIfNeeded,
  ESCALATE_CONFIDENCE_THRESHOLD,
} from '../../src/utils/classifier/llmEscalator';
import { classify } from '../../src/utils/classifier/engine';
import { LlmBudgetTracker } from '../../src/utils/llm/budget';
import {
  LlmConfigError,
  LlmInvalidOutputError,
  type LlmAdapter,
  type LlmSuggestRequest,
  type LlmSuggestResult,
} from '../../src/utils/llm/types';
import type { ClassifierInput, FailureClassification } from '../../src/utils/classifier/types';

function makeStubAdapter(
  outputOrError: { output: unknown; costUsd?: number } | Error,
): LlmAdapter & { calls: number } {
  const calls = 0;
  const adapter = {
    providerId: 'stub',
    calls,
    async suggest<T>(_req: LlmSuggestRequest<T>): Promise<LlmSuggestResult<T>> {
      adapter.calls += 1;
      if (outputOrError instanceof Error) throw outputOrError;
      return {
        output: outputOrError.output as T,
        tokensIn: 100,
        tokensOut: 50,
        costUsd: outputOrError.costUsd ?? 0.001,
        modelUsed: 'stub-model',
      };
    },
  };
  return adapter as LlmAdapter & { calls: number };
}

function baseInput(over: Partial<ClassifierInput> = {}): ClassifierInput {
  return {
    testId: 'Suite > Mystery test',
    errorMessage: 'something opaque',
    layer: 'UI',
    reproductionRate: 1.0,
    envContext: 'both',
    evidenceFiles: ['logs/x.log'],
    ...over,
  };
}

describe('shouldEscalate', () => {
  it('UNKNOWN → true', () => {
    const initial: FailureClassification = {
      testId: 'x',
      category: 'UNKNOWN',
      layer: 'UI',
      reproducible: true,
      reproductionRate: 1,
      routeTo: 7,
      assignTo: 'qa_team',
      priority: 'P2',
      rootCause: { description: 'x', evidence: [] },
      confidence: 0,
      matchedRule: 'no-match',
    };
    expect(shouldEscalate(initial)).to.be.true;
  });

  it('confidence < threshold → true', () => {
    const r = classify(baseInput()); // UNKNOWN, conf=0
    expect(shouldEscalate(r)).to.be.true;
  });

  it('high-confidence rule match → false', () => {
    const r = classify(baseInput({ layer: 'API', httpStatusCode: 500 }));
    expect(r.confidence).to.be.at.least(ESCALATE_CONFIDENCE_THRESHOLD);
    expect(shouldEscalate(r)).to.be.false;
  });
});

describe('escalateIfNeeded', () => {
  let tmpDir: string;
  let tracker: LlmBudgetTracker;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escalator-test-'));
    tracker = new LlmBudgetTracker({
      statePath: path.join(tmpDir, 'spend.json'),
      budgetMonthlyUsd: 1,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('high-confidence classification → no adapter call, return as-is', async () => {
    const input = baseInput({ layer: 'API', httpStatusCode: 500 });
    const initial = classify(input);
    const adapter = makeStubAdapter({ output: { foo: 'bar' } });
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(r).to.equal(initial);
    expect(adapter.calls).to.equal(0);
  });

  it('UNKNOWN → adapter called, classification upgraded', async () => {
    const input = baseInput();
    const initial = classify(input);
    expect(initial.category).to.equal('UNKNOWN');
    const adapter = makeStubAdapter({
      output: {
        category: 'SCRIPT_ISSUE',
        routeTo: 4,
        rootCauseDescription: 'Locator drift detected by LLM analysis',
        confidence: 0.92,
        reasoning: 'Error mentions ~test- selector and reproducible',
      },
      costUsd: 0.005,
    });
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(adapter.calls).to.equal(1);
    expect(r.category).to.equal('SCRIPT_ISSUE');
    expect(r.routeTo).to.equal(4);
    expect(r.assignTo).to.equal('qa_team');
    expect(r.priority).to.equal('P2');
    expect(r.confidence).to.equal(0.92);
    expect(r.matchedRule).to.equal('llm-escalator');
    expect(r.rootCause.description).to.include('LLM reasoning');
    expect(r.rootCause.evidence).to.deep.equal(['logs/x.log']);
    const spend = await tracker.getCurrentSpend();
    expect(spend.totalUsd).to.be.closeTo(0.005, 1e-9);
  });

  it('LLM returns BUG → assignTo dev_team, P0', async () => {
    const input = baseInput();
    const initial = classify(input);
    const adapter = makeStubAdapter({
      output: {
        category: 'BUG',
        routeTo: 1,
        rootCauseDescription: 'API contract drift detected',
        confidence: 0.91,
        reasoning: 'Schema mismatch evidence in logs',
      },
    });
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(r.category).to.equal('BUG');
    expect(r.assignTo).to.equal('dev_team');
    expect(r.priority).to.equal('P0');
  });

  it('LLM returns ENV_ISSUE → assignTo devops_team, P1', async () => {
    const input = baseInput();
    const initial = classify(input);
    const adapter = makeStubAdapter({
      output: {
        category: 'ENV_ISSUE',
        routeTo: 3,
        rootCauseDescription: 'CI runner network policy drop',
        confidence: 0.88,
        reasoning: 'Pattern matches known infra issue',
      },
    });
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(r.assignTo).to.equal('devops_team');
    expect(r.priority).to.equal('P1');
  });

  it('budget exceeded sau call → fallback initial', async () => {
    // Tracker budget=1; pre-fill spend = 0.999 → bất kỳ cost > 0.001 sẽ vượt.
    await tracker.record(0.999);
    const input = baseInput();
    const initial = classify(input);
    const adapter = makeStubAdapter({
      output: {
        category: 'SCRIPT_ISSUE',
        routeTo: 4,
        rootCauseDescription: 'x'.repeat(20),
        confidence: 0.9,
        reasoning: 'y'.repeat(20),
      },
      costUsd: 0.5,
    });
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(r).to.equal(initial); // fallback
  });

  it('LlmInvalidOutputError → fallback initial', async () => {
    const input = baseInput();
    const initial = classify(input);
    const adapter = makeStubAdapter(new LlmInvalidOutputError('schema mismatch', '{bad}'));
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(r).to.equal(initial);
  });

  it('LlmConfigError → fallback initial', async () => {
    const input = baseInput();
    const initial = classify(input);
    const adapter = makeStubAdapter(new LlmConfigError('provider=none'));
    const r = await escalateIfNeeded(input, initial, { adapter, tracker });
    expect(r).to.equal(initial);
  });

  it('unexpected error → bubble (không swallow)', async () => {
    const input = baseInput();
    const initial = classify(input);
    const adapter = makeStubAdapter(new Error('network down'));
    let thrown: unknown;
    try {
      await escalateIfNeeded(input, initial, { adapter, tracker });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(Error);
    expect((thrown as Error).message).to.equal('network down');
  });
});
