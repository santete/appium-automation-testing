/**
 * TC_PERF_SEARCH_001 — Performance: 5 iterations of products list render → P95 ≤ 1500 ms.
 *
 * Spec ref: §7.5 P95 SLA (search <1.5s). Plan ref: M6 Task 1.
 *
 * Sauce Demo không có search bar → đo proxy "products list render" làm
 * target SLA. Stopwatch start sau khi tap LOGIN, stop khi first ADD TO CART
 * button visible. Login latency cấu thành phần lớn proxy này nhưng đó là
 * bound thực tế user thấy products.
 */
import { describe, it } from 'mocha';
import { browser } from '@wdio/globals';
import { LoginPage } from '../../src/pages/LoginPage';
import { logger } from '../../src/utils/logger';
import { waitForVisible } from '../../src/utils/wait';
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { UiChecker } from '../../src/utils/assertion/checkers/UiChecker';
import { wdioUiCheckerDeps } from '../../src/utils/assertion/checkers/wdioUiCheckerDeps';
import { PerfChecker, InMemoryMarkerStore } from '../../src/utils/assertion/checkers/PerfChecker';
import { runPerfFlow } from '../../src/utils/perf/runPerfFlow';
import { resolvePerfThreshold } from '../../src/utils/perf/resolveThreshold';
import { attachVerdictToAllure, getDefaultAllure } from '../../src/utils/assertion/allureReport';

const APP_PACKAGE = 'com.swaglabsmobileapp';

describe('TC_PERF_SEARCH_001 — Performance: products render P95 env-aware threshold', () => {
  it('passes AC_PERF_SEARCH_001 contract', async function () {
    this.timeout(180_000);
    const account = globalThis.testAccount;
    if (!account) throw new Error('globalThis.testAccount not set');

    const threshold = resolvePerfThreshold('AC_PERF_SEARCH_001');
    const loginPage = new LoginPage();
    const driver = browser as unknown as {
      terminateApp: (pkg: string) => Promise<void>;
      activateApp: (pkg: string) => Promise<void>;
    };

    const { stats, withinSla } = await runPerfFlow({
      flow: 'search',
      testId: 'TC_PERF_SEARCH_001',
      thresholdMs: threshold.thresholdMs,
      iterations: 5,
      meta: {
        env: process.env.ENV_PROFILE ?? 'local',
        device: process.env.ANDROID_DEVICE_NAME ?? 'unknown',
        branch: process.env.GITHUB_REF_NAME ?? 'local',
      },
      actionFn: async (i) => {
        if (i > 0) {
          await driver.terminateApp(APP_PACKAGE);
          await driver.activateApp(APP_PACKAGE);
        }
        await loginPage.waitForLoaded();
        await loginPage.login(account.username, account.password);
        const t0 = Date.now();
        await waitForVisible('~test-ADD TO CART', {
          description: 'First ADD TO CART button (products render proxy)',
          timeout: 15_000,
        });
        return Date.now() - t0;
      },
    });

    const markers = new InMemoryMarkerStore();
    markers.set('search_p95_start', 0);
    markers.set('search_p95_end', Math.round(stats.p95));

    const runner = new AssertionRunner({
      ui: new UiChecker(wdioUiCheckerDeps),
      perf: new PerfChecker({ markers }),
    });
    const verdict = await runner.runContractById('AC_PERF_SEARCH_001');

    const allure = await getDefaultAllure();
    attachVerdictToAllure(verdict, allure);
    logger.info('TC_PERF_SEARCH_001 verdict', {
      status: verdict.status,
      p95: stats.p95,
      withinSla,
      thresholdMs: threshold.thresholdMs,
      thresholdSource: threshold.source,
    });

    if (verdict.status === 'FAIL') {
      const fails = verdict.results
        .filter((r) => !r.passed)
        .map((r) => `[${r.layer}/${r.severity}] ${r.id}: ${r.message ?? ''}`)
        .join('\n  ');
      throw new Error(
        `AC_PERF_SEARCH_001 FAIL (P95=${stats.p95}ms, threshold=${threshold.thresholdMs}ms ` +
          `via ${threshold.source}${threshold.envVar ? `=${threshold.envVar}` : ''})\n  ${fails}`,
      );
    }
  });
});
