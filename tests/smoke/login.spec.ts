/**
 * TC_LOGIN_001 — Smoke: User logs in with valid credentials
 *
 * Multi-layer assertion qua AssertionRunner + AC_LOGIN_001.yaml contract.
 *
 * Cred resolution: globalThis.testAccount được set bởi `tests/_hooks/global.ts`
 * (Mocha root hook plugin) — lease account từ AccountPool ở beforeEach,
 * release ở afterEach. KHÔNG đọc TEST_USERNAME/TEST_PASSWORD từ env (D2 repaid M3).
 *
 * ⚠️ Outstanding debt:
 *   - D3 (M3 path B): AC_LOGIN_001 vẫn không có api_layer (Sauce Demo offline);
 *     API capability proven qua AC_API_DEMO_001 + tests/api/api-demo.spec.ts.
 *
 * Spec ref: §5 Assertion Contract, §6 multi-layer validation.
 */
import { describe, it } from 'mocha';
import { browser } from '@wdio/globals';
import { LoginPage } from '../../src/pages/LoginPage';
import { logger } from '../../src/utils/logger';
import { waitForVisible } from '../../src/utils/wait';
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { UiChecker } from '../../src/utils/assertion/checkers/UiChecker';
import { wdioUiCheckerDeps } from '../../src/utils/assertion/checkers/wdioUiCheckerDeps';
import { NegativeChecker } from '../../src/utils/assertion/checkers/NegativeChecker';
import { LogCapture, createAppiumLogCaptureDeps } from '../../src/utils/logCapture';
import { attachVerdictToAllure, getDefaultAllure } from '../../src/utils/assertion/allureReport';

describe('TC_LOGIN_001 — Smoke: Login with valid credentials', () => {
  const loginPage = new LoginPage();

  it('passes AC_LOGIN_001 multi-layer contract', async () => {
    const account = globalThis.testAccount;
    if (!account) {
      throw new Error(
        'globalThis.testAccount not set — đảm bảo tests/_hooks/global.ts được load qua mochaOpts.require trong wdio config.',
      );
    }

    await loginPage.login(account.username, account.password);

    // Post-login readiness gate: AssertionRunner không tự wait, nên cần explicit
    // wait cho cart icon (post-login indicator) trước khi chạy UI checks. M1
    // có wait này nhưng bị mất khi refactor sang contract pattern.
    await waitForVisible('~test-Cart', {
      description: 'Cart icon (post-login indicator)',
      timeout: 15000,
    });

    const runner = new AssertionRunner({
      ui: new UiChecker(wdioUiCheckerDeps),
      negative: new NegativeChecker({
        logCapture: new LogCapture(
          createAppiumLogCaptureDeps(
            browser as unknown as { getLogs: (t: string) => Promise<unknown[]> },
          ),
        ),
        // Sauce Demo: process_alive không cần cho TC_LOGIN_001; throw nếu lỡ
        // dùng để fail-fast thay vì silent skip.
        isProcessAlive: async () => {
          throw new Error('process_alive not configured for TC_LOGIN_001');
        },
      }),
    });

    const verdict = await runner.runContractById('AC_LOGIN_001');

    const allure = await getDefaultAllure();
    attachVerdictToAllure(verdict, allure);

    logger.info('TC_LOGIN_001 verdict', {
      status: verdict.status,
      stoppedEarly: verdict.stoppedEarly,
      results: verdict.results.length,
    });

    if (verdict.status === 'FAIL') {
      const fails = verdict.results.filter((r) => !r.passed);
      const summary = fails
        .map((r) => `[${r.layer}/${r.severity}] ${r.id}: ${r.message ?? ''}`)
        .join('\n  ');
      throw new Error(`AC_LOGIN_001 FAIL\n  ${summary}`);
    }
  });
});
