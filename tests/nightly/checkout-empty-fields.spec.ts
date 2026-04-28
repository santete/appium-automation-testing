/**
 * TC_CHECKOUT_NEG_001 — Nightly: Checkout step 1 empty First Name → error
 *
 * Edge case: user submit CONTINUE mà First Name trống → Sauce Demo show
 * error "First Name is required" + giữ trên step 1. Đảm bảo guard form
 * server/client side hoạt động + không crash.
 *
 * Spec ref: §5.2 contract, §6 multi-layer.
 */
import { describe, it } from 'mocha';
import { browser } from '@wdio/globals';
import { LoginPage } from '../../src/pages/LoginPage';
import { ProductsPage } from '../../src/pages/ProductsPage';
import { CartPage } from '../../src/pages/CartPage';
import { CheckoutPage } from '../../src/pages/CheckoutPage';
import { logger } from '../../src/utils/logger';
import { waitForVisible } from '../../src/utils/wait';
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { UiChecker } from '../../src/utils/assertion/checkers/UiChecker';
import { wdioUiCheckerDeps } from '../../src/utils/assertion/checkers/wdioUiCheckerDeps';
import { NegativeChecker } from '../../src/utils/assertion/checkers/NegativeChecker';
import { LogCapture, createAppiumLogCaptureDeps } from '../../src/utils/logCapture';
import { attachVerdictToAllure, getDefaultAllure } from '../../src/utils/assertion/allureReport';

describe('TC_CHECKOUT_NEG_001 — Nightly: Checkout empty First Name → error', () => {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();

  it('passes AC_CHECKOUT_NEG_001 multi-layer contract', async () => {
    const account = globalThis.testAccount;
    if (!account) {
      throw new Error('globalThis.testAccount not set');
    }

    await loginPage.login(account.username, account.password);
    await productsPage.waitForLoaded();
    await productsPage.addFirstProduct();
    await productsPage.openCart();
    await cartPage.waitForLoaded();
    await cartPage.tapCheckout();

    await checkoutPage.waitForStep1();
    // Intentionally empty First Name (Sauce Demo validate first non-empty
    // field từ trên xuống — bỏ trống First Name là đủ trigger error).
    await checkoutPage.fillInfo({ firstName: '', lastName: 'Test', postalCode: '700000' });
    await checkoutPage.tapContinue();

    await waitForVisible('~test-Error message', {
      description: 'Checkout step 1 error banner (empty First Name)',
      timeout: 10000,
    });

    const errText = (await checkoutPage.getError()) ?? '';
    logger.info('Checkout error captured', { error: errText });

    const runner = new AssertionRunner({
      ui: new UiChecker(wdioUiCheckerDeps),
      negative: new NegativeChecker({
        logCapture: new LogCapture(
          createAppiumLogCaptureDeps(
            browser as unknown as { getLogs: (t: string) => Promise<unknown[]> },
          ),
        ),
        isProcessAlive: async () => {
          throw new Error('process_alive not configured for AC_CHECKOUT_NEG_001');
        },
      }),
    });

    const verdict = await runner.runContractById('AC_CHECKOUT_NEG_001');

    const allure = await getDefaultAllure();
    attachVerdictToAllure(verdict, allure);

    logger.info('TC_CHECKOUT_NEG_001 verdict', {
      status: verdict.status,
      results: verdict.results.length,
    });

    if (verdict.status === 'FAIL') {
      const fails = verdict.results.filter((r) => !r.passed);
      const summary = fails
        .map((r) => `[${r.layer}/${r.severity}] ${r.id}: ${r.message ?? ''}`)
        .join('\n  ');
      throw new Error(`AC_CHECKOUT_NEG_001 FAIL\n  ${summary}`);
    }
  });
});
