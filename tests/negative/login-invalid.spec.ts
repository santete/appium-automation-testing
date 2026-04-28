/**
 * TC_LOGIN_NEG_001 — Negative: Login with invalid credentials
 *
 * 2 cases share contract AC_LOGIN_NEG_001 (multi-layer UI + Negative):
 *   1. Wrong password → "Username and password do not match any user..."
 *   2. Locked-out user → "Sorry, this user has been locked out."
 *
 * Cred resolution: pass-through trong spec — KHÔNG qua AccountPool. Negative
 * cred là intentional test data (non-existent / locked), không cần isolation
 * như standard pool. Hook tests/_hooks/global.ts vẫn lease 'standard' (waste
 * harmless) — không override để giữ hook đơn giản.
 *
 * Spec ref: §5.2 contract, §6 multi-layer (UI + Negative crash log).
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

interface NegCase {
  label: string;
  username: string;
  password: string;
  expectedSubstring: string;
}

const cases: NegCase[] = [
  {
    label: 'wrong password',
    username: 'not_a_real_user',
    password: 'bad_password',
    expectedSubstring: 'do not match',
  },
  {
    label: 'locked-out user',
    username: 'locked_out_user',
    password: 'secret_sauce',
    expectedSubstring: 'locked out',
  },
];

describe('TC_LOGIN_NEG_001 — Negative: Login with invalid credentials', () => {
  const loginPage = new LoginPage();

  for (const c of cases) {
    it(`passes AC_LOGIN_NEG_001 — ${c.label}`, async () => {
      await loginPage.login(c.username, c.password);

      // Post-submit readiness gate: error banner xuất hiện cùng vị trí với
      // login form (Sauce Demo không navigate ra screen khác khi fail). Wait
      // for ~test-Error message để đảm bảo UI checker không race với render.
      await waitForVisible('~test-Error message', {
        description: `Login error banner (${c.label})`,
        timeout: 10000,
      });

      const errText = (await loginPage.getErrorMessage()) ?? '';
      logger.info('Login error captured', { case: c.label, error: errText });
      if (!errText.toLowerCase().includes(c.expectedSubstring)) {
        throw new Error(
          `Error text mismatch for "${c.label}": expected substring "${c.expectedSubstring}", got "${errText}"`,
        );
      }

      const runner = new AssertionRunner({
        ui: new UiChecker(wdioUiCheckerDeps),
        negative: new NegativeChecker({
          logCapture: new LogCapture(
            createAppiumLogCaptureDeps(
              browser as unknown as { getLogs: (t: string) => Promise<unknown[]> },
            ),
          ),
          isProcessAlive: async () => {
            throw new Error('process_alive not configured for AC_LOGIN_NEG_001');
          },
        }),
      });

      const verdict = await runner.runContractById('AC_LOGIN_NEG_001');

      const allure = await getDefaultAllure();
      attachVerdictToAllure(verdict, allure);

      logger.info('TC_LOGIN_NEG_001 verdict', {
        case: c.label,
        status: verdict.status,
        results: verdict.results.length,
      });

      if (verdict.status === 'FAIL') {
        const fails = verdict.results.filter((r) => !r.passed);
        const summary = fails
          .map((r) => `[${r.layer}/${r.severity}] ${r.id}: ${r.message ?? ''}`)
          .join('\n  ');
        throw new Error(`AC_LOGIN_NEG_001 FAIL (${c.label})\n  ${summary}`);
      }
    });
  }
});
