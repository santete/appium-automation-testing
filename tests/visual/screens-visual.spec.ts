/**
 * TC_VIS_001-005 — Visual regression: 5 baseline screens.
 *
 * Spec ref: §1.2 (visual regression). Plan ref: M6 Task 2.
 *
 * Screens covered:
 *   1. login_screen — pre-login (Username/Password/LOGIN visible).
 *   2. products_screen — post-login product list.
 *   3. cart_screen — cart with 1 item.
 *   4. checkout_step1 — checkout info form.
 *   5. checkout_complete — final success screen.
 *
 * First-run flow:
 *   - Run với env `VISUAL_UPDATE_BASELINES=1` → spec ghi baseline PNG vào
 *     tests/fixtures/visual/baselines/<screen>.png.
 *   - Dev review baseline files → commit.
 * Subsequent runs: spec compare baseline vs runtime → assert ≤ 0.5%.
 *
 * Mismatch threshold: default 0.5% (config-fy via opts.mismatchThresholdPct).
 * Sauce Demo: status bar + clock thay đổi → ignoreRegions cấu hình per-spec.
 */
import { describe, it, beforeEach } from 'mocha';
import { browser } from '@wdio/globals';
import { LoginPage } from '../../src/pages/LoginPage';
import { ProductsPage } from '../../src/pages/ProductsPage';
import { CartPage } from '../../src/pages/CartPage';
import { CheckoutPage } from '../../src/pages/CheckoutPage';
import { visualAssert } from '../../src/utils/visual/visualAssert';
import { logger } from '../../src/utils/logger';
import * as allure from '@wdio/allure-reporter';

interface Allurish {
  addAttachment: (name: string, content: Buffer | string, mime: string) => void;
}

function getAllure(): { attach: (name: string, content: Buffer | string, mime: string) => void } {
  const a =
    (allure as unknown as { default?: Allurish }).default ?? (allure as unknown as Allurish);
  return {
    attach: (name: string, content: Buffer | string, mime: string) =>
      a.addAttachment(name, content, mime),
  };
}

const STATUS_BAR_REGION = { left: 0, top: 0, right: 1080, bottom: 80 };

describe('Visual regression — 5 baseline screens', () => {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();
  const driver = browser as unknown as { takeScreenshot: () => Promise<string> };

  let account: { username: string; password: string } | undefined;

  // D9 fix: global hook (tests/_hooks/global.ts) sets `globalThis.testAccount`
  // via root-level `beforeEach` — runs BEFORE each it. Suite-level `before`
  // ran once before the global hook had a chance to lease an account, leaving
  // `account` undefined. Switch to `beforeEach` so we read the lease the
  // global hook just performed for this test.
  beforeEach(() => {
    account = globalThis.testAccount;
    if (!account) throw new Error('globalThis.testAccount not set');
  });

  it('TC_VIS_001 login_screen baseline matches', async function () {
    this.timeout(60_000);
    await loginPage.waitForLoaded();
    const r = await visualAssert(driver, 'login_screen', {
      mismatchThresholdPct: 0.5,
      ignoreRegions: [STATUS_BAR_REGION],
      allure: getAllure(),
    });
    logger.info('TC_VIS_001 result', { mode: r.mode, pct: r.comparison?.mismatchPct });
  });

  it('TC_VIS_002 products_screen baseline matches', async function () {
    this.timeout(60_000);
    await loginPage.login(account!.username, account!.password);
    await productsPage.waitForLoaded();
    const r = await visualAssert(driver, 'products_screen', {
      mismatchThresholdPct: 0.5,
      ignoreRegions: [STATUS_BAR_REGION],
      allure: getAllure(),
    });
    logger.info('TC_VIS_002 result', { mode: r.mode, pct: r.comparison?.mismatchPct });
  });

  it('TC_VIS_003 cart_screen baseline matches', async function () {
    this.timeout(60_000);
    await productsPage.addFirstProduct();
    await productsPage.openCart();
    await cartPage.waitForLoaded();
    const r = await visualAssert(driver, 'cart_screen', {
      mismatchThresholdPct: 0.5,
      ignoreRegions: [STATUS_BAR_REGION],
      allure: getAllure(),
    });
    logger.info('TC_VIS_003 result', { mode: r.mode, pct: r.comparison?.mismatchPct });
  });

  it('TC_VIS_004 checkout_step1 baseline matches', async function () {
    this.timeout(60_000);
    await cartPage.tapCheckout();
    await checkoutPage.waitForStep1();
    const r = await visualAssert(driver, 'checkout_step1', {
      mismatchThresholdPct: 0.5,
      ignoreRegions: [STATUS_BAR_REGION],
      allure: getAllure(),
    });
    logger.info('TC_VIS_004 result', { mode: r.mode, pct: r.comparison?.mismatchPct });
  });

  it('TC_VIS_005 checkout_complete baseline matches', async function () {
    this.timeout(60_000);
    await checkoutPage.fillInfo({ firstName: 'V', lastName: 'R', postalCode: '94000' });
    await checkoutPage.tapContinue();
    await checkoutPage.tapFinish();
    await checkoutPage.waitForComplete();
    const r = await visualAssert(driver, 'checkout_complete', {
      mismatchThresholdPct: 0.5,
      ignoreRegions: [STATUS_BAR_REGION],
      allure: getAllure(),
    });
    logger.info('TC_VIS_005 result', { mode: r.mode, pct: r.comparison?.mismatchPct });
  });
});
