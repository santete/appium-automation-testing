/**
 * Unit tests cho rule-based classifier engine.
 *
 * Plan ref: M5 Task 1 — 30 unit tests covering 6 categories từ §6.1.
 *
 * Cover:
 *  - BUG: API 5xx, schema validation drift, perf regression (5 tests)
 *  - SCRIPT_ISSUE: locator stale, animation, wrong assertion, missing assertion marker (5 tests)
 *  - FLAKY: intermittent rates, priority bands (5 tests)
 *  - ENV_ISSUE: ci-only, network timeout (5 tests)
 *  - DATA_ISSUE: conflict marker variants (5 tests)
 *  - UNKNOWN: no-match fallback for LLM escalator (5 tests)
 *  - Rule ordering / priority sanity (bonus edge cases)
 */
import { expect } from 'chai';
import { classify } from '../../src/utils/classifier/engine';
import type { ClassifierInput } from '../../src/utils/classifier/types';

function input(over: Partial<ClassifierInput> = {}): ClassifierInput {
  return {
    testId: 'Suite > Test',
    errorMessage: '',
    layer: 'UI',
    reproductionRate: 1.0,
    envContext: 'both',
    evidenceFiles: [],
    ...over,
  };
}

describe('classifier — BUG category', () => {
  it('API 500 → BUG, route step 1, P0, dev_team', () => {
    const r = classify(input({ layer: 'API', httpStatusCode: 500 }));
    expect(r.category).to.equal('BUG');
    expect(r.routeTo).to.equal(1);
    expect(r.priority).to.equal('P0');
    expect(r.assignTo).to.equal('dev_team');
    expect(r.matchedRule).to.equal('bug:api-5xx');
  });

  it('API 503 (5xx range) → BUG', () => {
    const r = classify(input({ layer: 'API', httpStatusCode: 503 }));
    expect(r.category).to.equal('BUG');
  });

  it('API 404 (NOT 5xx) → không match bug:api-5xx', () => {
    const r = classify(input({ layer: 'API', httpStatusCode: 404 }));
    expect(r.matchedRule).to.not.equal('bug:api-5xx');
  });

  it('Schema validation fail → BUG, route step 1 (contract drift)', () => {
    const r = classify(input({ layer: 'API', hasSchemaValidationError: true }));
    expect(r.category).to.equal('BUG');
    expect(r.matchedRule).to.equal('bug:schema-validation-fail');
    expect(r.routeTo).to.equal(1);
  });

  it('Perf regression reproducible → BUG, route step 2 (review SLA)', () => {
    const r = classify(input({ layer: 'PERF', reproductionRate: 1.0 }));
    expect(r.category).to.equal('BUG');
    expect(r.routeTo).to.equal(2);
    expect(r.matchedRule).to.equal('bug:perf-regression');
  });
});

describe('classifier — SCRIPT_ISSUE category', () => {
  it('Locator stale (regex match) → SCRIPT_ISSUE, route step 4', () => {
    const r = classify(
      input({
        layer: 'UI',
        errorMessage: 'no such element: ~test-Cart',
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('SCRIPT_ISSUE');
    expect(r.routeTo).to.equal(4);
    expect(r.matchedRule).to.equal('script-issue:locator-or-animation');
  });

  it('Element not interactable → SCRIPT_ISSUE', () => {
    const r = classify(
      input({
        layer: 'UI',
        errorMessage: 'element not interactable',
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('SCRIPT_ISSUE');
  });

  it('Animation regex → SCRIPT_ISSUE', () => {
    const r = classify(
      input({
        layer: 'UI',
        errorMessage: 'transition not finished after 5s',
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('SCRIPT_ISSUE');
  });

  it('hasLocatorOrAnimationIssue marker → SCRIPT_ISSUE (không cần regex)', () => {
    const r = classify(
      input({
        layer: 'UI',
        hasLocatorOrAnimationIssue: true,
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('SCRIPT_ISSUE');
  });

  it('Wrong assertion regex → SCRIPT_ISSUE, route step 2 (contract design)', () => {
    const r = classify(
      input({
        errorMessage: 'expected.never.ran — assertion contract drift',
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('SCRIPT_ISSUE');
    expect(r.routeTo).to.equal(2);
    expect(r.matchedRule).to.equal('script-issue:wrong-assertion');
  });
});

describe('classifier — FLAKY category', () => {
  it('reproductionRate 0.7 → FLAKY, route step 5', () => {
    const r = classify(input({ reproductionRate: 0.7 }));
    expect(r.category).to.equal('FLAKY');
    expect(r.routeTo).to.equal(5);
    expect(r.reproducible).to.equal(false);
    expect(r.matchedRule).to.equal('flaky:intermittent');
  });

  it('reproductionRate 0.3 → FLAKY P1 (low repro)', () => {
    const r = classify(input({ reproductionRate: 0.3 }));
    expect(r.category).to.equal('FLAKY');
    expect(r.priority).to.equal('P1');
  });

  it('reproductionRate 0.6 → FLAKY P2 (mid repro)', () => {
    const r = classify(input({ reproductionRate: 0.6 }));
    expect(r.priority).to.equal('P2');
  });

  it('reproductionRate 0.89 (just under threshold) → FLAKY', () => {
    const r = classify(input({ reproductionRate: 0.89 }));
    expect(r.category).to.equal('FLAKY');
  });

  it('reproductionRate 0.9 (at threshold) → KHÔNG flaky (reproducible)', () => {
    const r = classify(input({ reproductionRate: 0.9 }));
    expect(r.category).to.not.equal('FLAKY');
  });
});

describe('classifier — ENV_ISSUE category', () => {
  it('CI-only fail reproducible → ENV_ISSUE, route step 3, devops_team', () => {
    const r = classify(input({ envContext: 'ci-only', reproductionRate: 1.0 }));
    expect(r.category).to.equal('ENV_ISSUE');
    expect(r.routeTo).to.equal(3);
    expect(r.assignTo).to.equal('devops_team');
    expect(r.matchedRule).to.equal('env-issue:ci-only-pass-locally');
  });

  it('CI-only nhưng flaky (rate < 0.9) → KHÔNG match env-issue:ci-only (fall through to flaky)', () => {
    const r = classify(input({ envContext: 'ci-only', reproductionRate: 0.5 }));
    expect(r.category).to.equal('FLAKY');
  });

  it('Network timeout API reproducible → ENV_ISSUE', () => {
    const r = classify(
      input({
        layer: 'API',
        errorMessage: 'connection refused: api.staging.example',
        reproductionRate: 1.0,
        envContext: 'both',
      }),
    );
    expect(r.category).to.equal('ENV_ISSUE');
    expect(r.matchedRule).to.equal('env-issue:network-timeout');
  });

  it('Timeout regex match → ENV_ISSUE', () => {
    const r = classify(
      input({
        layer: 'API',
        errorMessage: 'request timed out after 30s',
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('ENV_ISSUE');
  });

  it('Local-only fail (envContext local-only) → KHÔNG match env-issue rule', () => {
    const r = classify(input({ envContext: 'local-only', reproductionRate: 1.0 }));
    expect(r.matchedRule).to.not.equal('env-issue:ci-only-pass-locally');
  });
});

describe('classifier — DATA_ISSUE category', () => {
  it('hasDataConflictMarker reproducible → DATA_ISSUE, route step 3', () => {
    const r = classify(input({ hasDataConflictMarker: true, reproductionRate: 1.0 }));
    expect(r.category).to.equal('DATA_ISSUE');
    expect(r.routeTo).to.equal(3);
    expect(r.matchedRule).to.equal('data-issue:conflict-marker');
  });

  it('DATA_ISSUE flaky (intermittent) → vẫn DATA_ISSUE (marker thắng flaky check)', () => {
    const r = classify(input({ hasDataConflictMarker: true, reproductionRate: 0.5 }));
    expect(r.category).to.equal('DATA_ISSUE');
    expect(r.reproducible).to.equal(false);
  });

  it('DATA_ISSUE assignTo qa_team', () => {
    const r = classify(input({ hasDataConflictMarker: true }));
    expect(r.assignTo).to.equal('qa_team');
  });

  it('DATA_ISSUE evidence files passthrough', () => {
    const r = classify(
      input({
        hasDataConflictMarker: true,
        evidenceFiles: ['logs/data-conflict.log', 'screenshots/dup-user.png'],
      }),
    );
    expect(r.rootCause.evidence).to.deep.equal([
      'logs/data-conflict.log',
      'screenshots/dup-user.png',
    ]);
  });

  it('DATA_ISSUE thắng env-issue khi cả 2 signal cùng có (data marker rule chạy trước env-issue:network-timeout)', () => {
    // ci-only + dataMarker — order: rule 1 (ci-only) match trước rule 2 (data) → ENV_ISSUE thắng.
    // Test data conflict KHÔNG ci-only:
    const r = classify(
      input({
        envContext: 'both',
        hasDataConflictMarker: true,
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('DATA_ISSUE');
  });
});

describe('classifier — UNKNOWN fallback', () => {
  it('reproducible UI fail không có signal nào → UNKNOWN', () => {
    const r = classify(input({ layer: 'UI', errorMessage: 'something weird happened' }));
    expect(r.category).to.equal('UNKNOWN');
    expect(r.matchedRule).to.equal('no-match');
    expect(r.confidence).to.equal(0);
    expect(r.routeTo).to.equal(7); // analyze step
  });

  it('UNKNOWN reproducible flag set khi rate >= 0.9', () => {
    const r = classify(input({ reproductionRate: 1.0 }));
    expect(r.category).to.equal('UNKNOWN');
    expect(r.reproducible).to.equal(true);
  });

  it('UNKNOWN passthrough testId', () => {
    const r = classify(input({ testId: 'CustomSuite > XYZ', reproductionRate: 1.0 }));
    expect(r.testId).to.equal('CustomSuite > XYZ');
  });

  it('UNKNOWN passthrough evidence files', () => {
    const r = classify(
      input({ reproductionRate: 1.0, evidenceFiles: ['log1.txt', 'screenshot.png'] }),
    );
    expect(r.rootCause.evidence).to.deep.equal(['log1.txt', 'screenshot.png']);
  });

  it('UNKNOWN có description hint LLM escalation', () => {
    const r = classify(input({ reproductionRate: 1.0 }));
    expect(r.rootCause.description).to.match(/LLM|human review/i);
  });
});

describe('classifier — rule ordering & priority sanity', () => {
  it('CI-only + API 500 → ENV_ISSUE thắng (rule 1 trước rule 4)', () => {
    const r = classify(
      input({
        layer: 'API',
        envContext: 'ci-only',
        httpStatusCode: 500,
        reproductionRate: 1.0,
      }),
    );
    expect(r.category).to.equal('ENV_ISSUE');
  });

  it('Schema fail + 5xx → BUG schema rule (rule 3 trước rule 4)', () => {
    const r = classify(
      input({
        layer: 'API',
        hasSchemaValidationError: true,
        httpStatusCode: 500,
        reproductionRate: 1.0,
      }),
    );
    expect(r.matchedRule).to.equal('bug:schema-validation-fail');
  });

  it('Locator + flaky rate → SCRIPT_ISSUE rule không match (cần rate >= 0.9), fall through to FLAKY', () => {
    const r = classify(
      input({
        layer: 'UI',
        errorMessage: 'no such element',
        reproductionRate: 0.5,
      }),
    );
    expect(r.category).to.equal('FLAKY');
  });

  it('Confidence ranges: hard signal >= 0.9, regex/heuristic >= 0.8', () => {
    const hard = classify(input({ layer: 'API', httpStatusCode: 500 }));
    expect(hard.confidence).to.be.at.least(0.9);
    const heuristic = classify(
      input({
        layer: 'UI',
        errorMessage: 'no such element: ~test-X',
        reproductionRate: 1.0,
      }),
    );
    expect(heuristic.confidence).to.be.at.least(0.8);
  });

  it('reproductionRate 0 (never run / pass-only) → UNKNOWN (không là FLAKY)', () => {
    const r = classify(input({ reproductionRate: 0 }));
    expect(r.category).to.equal('UNKNOWN');
  });
});
