/**
 * Unit tests cho từng Checker — predicate logic.
 *
 * Plan ref: M2 Task 10.
 */
import { expect } from 'chai';
import { z } from 'zod';
import {
  UiChecker,
  type UiCheckerDeps,
  type UiElement,
} from '../../src/utils/assertion/checkers/UiChecker';
import { ApiChecker } from '../../src/utils/assertion/checkers/ApiChecker';
import { StateChecker } from '../../src/utils/assertion/checkers/StateChecker';
import { NegativeChecker } from '../../src/utils/assertion/checkers/NegativeChecker';
import { PerfChecker, InMemoryMarkerStore } from '../../src/utils/assertion/checkers/PerfChecker';
import { LogCapture } from '../../src/utils/logCapture';

function fakeElement(overrides: Partial<UiElement>): UiElement {
  return {
    isDisplayed: async () => true,
    isExisting: async () => true,
    getText: async () => '',
    getAttribute: async () => null,
    ...overrides,
  };
}

function fakeUiDeps(map: Record<string, UiElement>): UiCheckerDeps {
  return {
    find: async (locator: string) => {
      const el = map[locator];
      if (!el) throw new Error(`fake: no element for ${locator}`);
      return el;
    },
  };
}

describe('UiChecker', () => {
  it('element_visible: pass when displayed', async () => {
    const checker = new UiChecker(
      fakeUiDeps({ '~ok': fakeElement({ isDisplayed: async () => true }) }),
    );
    const out = await checker.run({
      id: 'ui.ok',
      type: 'element_visible',
      severity: 'high',
      locator: '~ok',
    });
    expect(out.passed).to.equal(true);
  });

  it('element_visible: fail with clear message when not displayed', async () => {
    const checker = new UiChecker(
      fakeUiDeps({ '~hidden': fakeElement({ isDisplayed: async () => false }) }),
    );
    const out = await checker.run({
      id: 'ui.hidden',
      type: 'element_visible',
      severity: 'high',
      locator: '~hidden',
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('~hidden');
  });

  it('text_equals: fail prints expected vs actual', async () => {
    const checker = new UiChecker(
      fakeUiDeps({ '~t': fakeElement({ getText: async () => 'WRONG' }) }),
    );
    const out = await checker.run({
      id: 'ui.t',
      type: 'text_equals',
      severity: 'high',
      locator: '~t',
      expected: 'RIGHT',
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('RIGHT').and.to.contain('WRONG');
  });

  it('attribute_match: regex pass', async () => {
    const checker = new UiChecker(
      fakeUiDeps({ '~btn': fakeElement({ getAttribute: async () => 'login_001' }) }),
    );
    const out = await checker.run({
      id: 'ui.attr',
      type: 'attribute_match',
      severity: 'medium',
      locator: '~btn',
      attribute: 'content-desc',
      regex: '^login_\\d+$',
    });
    expect(out.passed).to.equal(true);
  });

  it('element_absent: pass when find() throws (not present)', async () => {
    const checker = new UiChecker({
      find: async () => {
        throw new Error('not found');
      },
    });
    const out = await checker.run({
      id: 'ui.absent',
      type: 'element_absent',
      severity: 'low',
      locator: '~gone',
    });
    expect(out.passed).to.equal(true);
  });
});

describe('ApiChecker', () => {
  it('http_request: status mismatch → fail with diff', async () => {
    const checker = new ApiChecker({
      request: async () => ({ status: 500, data: {} }),
    });
    const out = await checker.run({
      id: 'api.s',
      type: 'http_request',
      severity: 'high',
      method: 'GET',
      url: '/x',
      expect: { status: 200 },
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('200').and.to.contain('500');
  });

  it('http_request: schema_ref mismatch → fail with Zod issue path', async () => {
    const userSchema = z.object({ id: z.number(), name: z.string() });
    const checker = new ApiChecker({
      request: async () => ({ status: 200, data: { id: 'not-number', name: 'x' } }),
      schemaRegistry: { User: userSchema },
    });
    const out = await checker.run({
      id: 'api.sch',
      type: 'http_request',
      severity: 'high',
      method: 'GET',
      url: '/u',
      expect: { schema_ref: 'User' },
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('User');
  });

  it('http_request: body_contains nested partial match passes', async () => {
    const checker = new ApiChecker({
      request: async () => ({
        status: 200,
        data: { user: { id: 1, role: 'admin' }, extra: 'ignored' },
      }),
    });
    const out = await checker.run({
      id: 'api.b',
      type: 'http_request',
      severity: 'high',
      method: 'GET',
      url: '/u',
      expect: { body_contains: { user: { role: 'admin' } } },
    });
    expect(out.passed).to.equal(true);
  });

  it('http_request: schema_ref missing in registry → fail', async () => {
    const checker = new ApiChecker({
      request: async () => ({ status: 200, data: {} }),
      schemaRegistry: {},
    });
    const out = await checker.run({
      id: 'api.miss',
      type: 'http_request',
      severity: 'high',
      method: 'GET',
      url: '/u',
      expect: { schema_ref: 'NotFound' },
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('NotFound');
  });
});

describe('StateChecker', () => {
  it('not_null: pass when value present', async () => {
    const checker = new StateChecker({ getValue: async () => 'token-abc' });
    const out = await checker.run({
      id: 'state.t',
      type: 'state_property',
      severity: 'high',
      source: 'shared_prefs',
      package: 'com.t',
      key: 'token',
      expect: { not_null: true },
    });
    expect(out.passed).to.equal(true);
  });

  it('not_null: fail when null', async () => {
    const checker = new StateChecker({ getValue: async () => null });
    const out = await checker.run({
      id: 'state.t',
      type: 'state_property',
      severity: 'high',
      source: 'shared_prefs',
      package: 'com.t',
      key: 'token',
      expect: { not_null: true },
    });
    expect(out.passed).to.equal(false);
  });

  it('regex: pass on match', async () => {
    const checker = new StateChecker({ getValue: async () => 'user_42' });
    const out = await checker.run({
      id: 'state.r',
      type: 'state_property',
      severity: 'medium',
      source: 'shared_prefs',
      package: 'com.t',
      key: 'name',
      expect: { regex: '^user_\\d+$' },
    });
    expect(out.passed).to.equal(true);
  });
});

describe('NegativeChecker', () => {
  it('log_pattern_absent: pass when no match', async () => {
    const logCapture = new LogCapture({
      fetchLogs: async () => ['INFO: app started', 'DEBUG: tap'],
    });
    const checker = new NegativeChecker({
      logCapture,
      isProcessAlive: async () => true,
    });
    const out = await checker.run({
      id: 'neg.l',
      type: 'log_pattern_absent',
      severity: 'critical',
      log_source: 'logcat',
      pattern: 'CRASH',
    });
    expect(out.passed).to.equal(true);
  });

  it('log_pattern_absent: fail when match found, message includes sample', async () => {
    const logCapture = new LogCapture({
      fetchLogs: async () => ['ERROR: NullPointerException at Login', 'next line'],
    });
    const checker = new NegativeChecker({
      logCapture,
      isProcessAlive: async () => true,
    });
    const out = await checker.run({
      id: 'neg.l',
      type: 'log_pattern_absent',
      severity: 'critical',
      log_source: 'logcat',
      pattern: 'NullPointerException',
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('NullPointerException');
  });
});

describe('PerfChecker', () => {
  it('time_between: under threshold → pass', async () => {
    const markers = new InMemoryMarkerStore();
    markers.set('start', 1000);
    markers.set('end', 1500);
    const checker = new PerfChecker({ markers });
    const out = await checker.run({
      id: 'perf.t',
      type: 'time_between',
      severity: 'medium',
      start_marker: 'start',
      end_marker: 'end',
      max_ms: 800,
    });
    expect(out.passed).to.equal(true);
  });

  it('time_between: exceeds threshold → fail', async () => {
    const markers = new InMemoryMarkerStore();
    markers.set('start', 1000);
    markers.set('end', 3000);
    const checker = new PerfChecker({ markers });
    const out = await checker.run({
      id: 'perf.t',
      type: 'time_between',
      severity: 'medium',
      start_marker: 'start',
      end_marker: 'end',
      max_ms: 1500,
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('2000').and.to.contain('1500');
  });

  it('time_between: missing marker → fail with clear message', async () => {
    const checker = new PerfChecker({ markers: new InMemoryMarkerStore() });
    const out = await checker.run({
      id: 'perf.t',
      type: 'time_between',
      severity: 'medium',
      start_marker: 'never_recorded',
      end_marker: 'end',
      max_ms: 500,
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('never_recorded');
  });
});
