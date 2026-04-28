/**
 * TC_PURCHASE_001 — Regression: End-to-end purchase happy path
 *
 * Flow:
 *   1. Login (standard_user lease qua AccountPool)
 *   2. ProductsPage.addFirstProduct + assert badge = 1
 *   3. ProductsPage.openCart + CartPage.waitForLoaded
 *   4. CartPage.tapCheckout → CheckoutPage step 1
 *   5. CheckoutPage.fillInfo + tapContinue → step 2
 *   6. CheckoutPage.tapFinish → step 3 "CHECKOUT: COMPLETE!"
 *   7. Run AC_PURCHASE_001 multi-layer contract
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
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { UiChecker } from '../../src/utils/assertion/checkers/UiChecker';
import { wdioUiCheckerDeps } from '../../src/utils/assertion/checkers/wdioUiCheckerDeps';
import { NegativeChecker } from '../../src/utils/assertion/checkers/NegativeChecker';
import { LogCapture, createAppiumLogCaptureDeps } from '../../src/utils/logCapture';
import { attachVerdictToAllure, getDefaultAllure } from '../../src/utils/assertion/allureReport';

describe('TC_PURCHASE_001 — Regression: Purchase happy path', () => {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();

  it('passes AC_PURCHASE_001 multi-layer contract', async () => {
    const account = globalThis.testAccount;
    if (!account) {
      throw new Error(
        'globalThis.testAccount not set — kiểm tra mochaOpts.require trong wdio config.',
      );
    }

    await loginPage.login(account.username, account.password);
    await productsPage.waitForLoaded();

    await productsPage.addFirstProduct();
    const badgeAfterAdd = await productsPage.getCartBadgeCount();
    if (badgeAfterAdd !== 1) {
      throw new Error(`Expected cart badge = 1 after add, got ${badgeAfterAdd}`);
    }

    await productsPage.openCart();
    await cartPage.waitForLoaded();

    const itemsInCart = await cartPage.listItemTitles();
    if (itemsInCart.length !== 1) {
      throw new Error(`Expected 1 item in cart, got ${itemsInCart.length}`);
    }
    logger.info('Cart loaded', { items: itemsInCart });

    await cartPage.tapCheckout();
    await checkoutPage.fillInfo({
      firstName: 'Phuc',
      lastName: 'Test',
      postalCode: '700000',
    });
    await checkoutPage.tapContinue();
    await checkoutPage.tapFinish();
    await checkoutPage.waitForComplete();

    const runner = new AssertionRunner({
      ui: new UiChecker(wdioUiCheckerDeps),
      negative: new NegativeChecker({
        logCapture: new LogCapture(
          createAppiumLogCaptureDeps(
            browser as unknown as { getLogs: (t: string) => Promise<unknown[]> },
          ),
        ),
        isProcessAlive: async () => {
          throw new Error('process_alive not configured for AC_PURCHASE_001');
        },
      }),
    });

    const verdict = await runner.runContractById('AC_PURCHASE_001');

    const allure = await getDefaultAllure();
    attachVerdictToAllure(verdict, allure);

    logger.info('TC_PURCHASE_001 verdict', {
      status: verdict.status,
      results: verdict.results.length,
    });

    if (verdict.status === 'FAIL') {
      const fails = verdict.results.filter((r) => !r.passed);
      const summary = fails
        .map((r) => `[${r.layer}/${r.severity}] ${r.id}: ${r.message ?? ''}`)
        .join('\n  ');
      throw new Error(`AC_PURCHASE_001 FAIL\n  ${summary}`);
    }
  });
});
