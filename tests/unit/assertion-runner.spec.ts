/**
 * Unit tests cho AssertionRunner — verdict logic + severity flow + routing.
 *
 * Plan ref: M2 Task 10 (acceptance test sub-points 1-5).
 *
 * Mocked checkers — không cần Appium / Axios runtime.
 */
import { expect } from 'chai';
import { AssertionRunner, type CheckerSet } from '../../src/utils/assertion/AssertionRunner';
import type { AssertionContract } from '../../src/contracts/_schema';
import type { CheckOutcome } from '../../src/utils/assertion/types';

type AnyCheckerInput = { id: string; type: string; severity: string };

class FakeChecker {
  public callCount = 0;
  public callIds: string[] = [];
  constructor(private outcomes: Record<string, CheckOutcome>) {}
  async run(check: AnyCheckerInput): Promise<CheckOutcome> {
    this.callCount++;
    this.callIds.push(check.id);
    return this.outcomes[check.id] ?? { passed: true, evidence: [] };
  }
}

function buildContract(overrides: Partial<AssertionContract> = {}): AssertionContract {
  return {
    contract_id: 'AC_TEST_001',
    test_scenario: 'TC_TEST_001',
    schema_version: 'v1',
    description: 'unit test contract',
    positive: {
      ui_layer: [{ id: 'ui.a', type: 'element_visible', severity: 'high', locator: '~a' }],
    },
    negative: [],
    performance: [],
    ...overrides,
  } as AssertionContract;
}

function buildRunner(checkers: CheckerSet): AssertionRunner {
  let counter = 0;
  return new AssertionRunner(checkers, {
    now: () => 1000 + counter++,
    isoNow: () => '2026-04-27T00:00:00.000Z',
  });
}

describe('AssertionRunner — verdict logic', () => {
  it('all checks pass → PASS', async () => {
    const ui = new FakeChecker({ 'ui.a': { passed: true, evidence: [] } });
    const runner = buildRunner({ ui: ui as never });
    const verdict = await runner.runContract(buildContract());

    expect(verdict.status).to.equal('PASS');
    expect(verdict.stoppedEarly).to.equal(false);
    expect(verdict.results).to.have.lengthOf(1);
    expect(verdict.failureMetadata).to.equal(undefined);
  });

  it('critical fail → FAIL + stoppedEarly + remaining checks NOT executed', async () => {
    const ui = new FakeChecker({
      'ui.crit': { passed: false, message: 'gone', evidence: [] },
    });
    const state = new FakeChecker({});
    const runner = buildRunner({ ui: ui as never, state: state as never });

    const contract = buildContract({
      positive: {
        ui_layer: [
          { id: 'ui.crit', type: 'element_visible', severity: 'critical', locator: '~x' },
          { id: 'ui.next', type: 'element_visible', severity: 'high', locator: '~y' },
        ],
        state_layer: [
          {
            id: 'state.skip',
            type: 'state_property',
            severity: 'high',
            source: 'shared_prefs',
            package: 'com.test',
            key: 'k',
            expect: { not_null: true },
          },
        ],
      },
    });

    const verdict = await runner.runContract(contract);
    expect(verdict.status).to.equal('FAIL');
    expect(verdict.stoppedEarly).to.equal(true);
    expect(ui.callCount).to.equal(1);
    expect(state.callCount).to.equal(0);
  });

  it('high fail → FAIL but all checks run (no stop)', async () => {
    const ui = new FakeChecker({
      'ui.a': { passed: false, message: 'missing', evidence: [] },
      'ui.b': { passed: true, evidence: [] },
    });
    const runner = buildRunner({ ui: ui as never });
    const contract = buildContract({
      positive: {
        ui_layer: [
          { id: 'ui.a', type: 'element_visible', severity: 'high', locator: '~a' },
          { id: 'ui.b', type: 'element_visible', severity: 'high', locator: '~b' },
        ],
      },
    });

    const verdict = await runner.runContract(contract);
    expect(verdict.status).to.equal('FAIL');
    expect(verdict.stoppedEarly).to.equal(false);
    expect(ui.callCount).to.equal(2);
  });

  it('medium fail only → PASS_WITH_WARNINGS', async () => {
    const ui = new FakeChecker({
      'ui.med': { passed: false, message: 'medium issue', evidence: [] },
    });
    const runner = buildRunner({ ui: ui as never });
    const contract = buildContract({
      positive: {
        ui_layer: [{ id: 'ui.med', type: 'element_visible', severity: 'medium', locator: '~m' }],
      },
    });

    const verdict = await runner.runContract(contract);
    expect(verdict.status).to.equal('PASS_WITH_WARNINGS');
    expect(verdict.failureMetadata).to.equal(undefined);
  });

  it('low fail only → PASS', async () => {
    const ui = new FakeChecker({
      'ui.low': { passed: false, message: 'minor', evidence: [] },
    });
    const runner = buildRunner({ ui: ui as never });
    const contract = buildContract({
      positive: {
        ui_layer: [{ id: 'ui.low', type: 'element_visible', severity: 'low', locator: '~l' }],
      },
    });

    const verdict = await runner.runContract(contract);
    expect(verdict.status).to.equal('PASS');
  });

  it('FailureMetadata: UI fail → routeTo=4, dev_team', async () => {
    const ui = new FakeChecker({
      'ui.x': { passed: false, message: 'broken', evidence: [] },
    });
    const runner = buildRunner({ ui: ui as never });
    const contract = buildContract({
      positive: {
        ui_layer: [{ id: 'ui.x', type: 'element_visible', severity: 'high', locator: '~x' }],
      },
    });

    const verdict = await runner.runContract(contract);
    expect(verdict.failureMetadata?.layer).to.equal('UI');
    expect(verdict.failureMetadata?.routeTo).to.equal(4);
    expect(verdict.failureMetadata?.assignTo).to.equal('dev_team');
    expect(verdict.failureMetadata?.priority).to.equal('P2');
  });

  it('FailureMetadata: securityImpact → priority P0', async () => {
    const negative = new FakeChecker({
      'neg.security': {
        passed: false,
        message: 'pii leaked',
        evidence: [],
      },
    });
    const contract = buildContract({
      positive: {
        ui_layer: [{ id: 'ui.dummy', type: 'element_visible', severity: 'low', locator: '~d' }],
      },
      negative: [
        {
          id: 'neg.security',
          type: 'log_pattern_absent',
          severity: 'critical',
          log_source: 'logcat',
          pattern: '\\bpii\\b',
          securityImpact: true,
        },
      ],
    });
    const ui = new FakeChecker({ 'ui.dummy': { passed: true, evidence: [] } });

    const runnerFull = buildRunner({ ui: ui as never, negative: negative as never });
    const verdict = await runnerFull.runContract(contract);

    expect(verdict.status).to.equal('FAIL');
    expect(verdict.failureMetadata?.priority).to.equal('P0');
    expect(verdict.failureMetadata?.securityImpact).to.equal(true);
    expect(verdict.failureMetadata?.routeTo).to.equal(2);
  });

  it('throws when contract uses layer with no checker injected', async () => {
    const runner = buildRunner({});
    let err: Error | undefined;
    try {
      await runner.runContract(buildContract());
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message ?? '').to.match(/ui.*checker/);
  });

  it('checker invariant: passed=false without message → throws', async () => {
    const ui = new FakeChecker({
      'ui.a': { passed: false, evidence: [] }, // no message
    });
    const runner = buildRunner({ ui: ui as never });

    let err: Error | undefined;
    try {
      await runner.runContract(buildContract());
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message ?? '').to.match(/Checker invariant/);
  });
});
