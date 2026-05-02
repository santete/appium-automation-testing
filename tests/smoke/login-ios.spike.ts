/**
 * TC_LOGIN_IOS_SPIKE_001 — iOS smoke spike (M6 Task 8, Decision 9).
 *
 * Time-boxed spike (4-6h) verify framework cross-platform compat. Run on BS
 * iPhone 14 simulator. NOT counted in critical-flow coverage; spike-only.
 *
 * Run:
 *   BS_IOS_DEVICE=1 npx wdio run ./src/config/wdio.bs.ios.ts
 *
 * Skip behavior: nếu chạy không phải iOS (LoginPage selector iOS-specific
 * chưa map), skip với warning. Đây là spike spec, không phải production
 * regression.
 *
 * Outcome → docs/spikes/ios-support.md (full vs partial vs blocked verdict).
 */
import { describe, it, before } from 'mocha';
import { browser } from '@wdio/globals';
import { logger } from '../../src/utils/logger';

describe('TC_LOGIN_IOS_SPIKE_001 — iOS login spike', () => {
  before(function () {
    const platform = (browser.capabilities as { platformName?: string }).platformName;
    if (platform !== 'iOS') {
      logger.warn(`[ios-spike] not running on iOS (platform=${platform}) → skip`);
      this.skip();
    }
  });

  it('logs in on iPhone (Sauce Demo iOS)', async () => {
    // iOS Sauce Demo accessibility IDs differ from Android — spike validates
    // selector strategy translation. If this fails, spike doc records the gap.
    const usernameField = await browser.$('~test-Username');
    const passwordField = await browser.$('~test-Password');
    const loginBtn = await browser.$('~test-LOGIN');

    await usernameField.waitForDisplayed({ timeout: 15000 });
    await usernameField.setValue('standard_user');
    await passwordField.setValue('secret_sauce');
    await loginBtn.click();

    const cart = await browser.$('~test-Cart');
    await cart.waitForDisplayed({ timeout: 15000 });

    const visible = await cart.isDisplayed();
    if (!visible) {
      throw new Error('iOS spike FAIL — cart icon not visible after login');
    }
    logger.info('[ios-spike] login + cart visible — framework cross-platform OK on iOS');
  });
});
