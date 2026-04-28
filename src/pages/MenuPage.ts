/**
 * MenuPage — Sauce Labs Demo App side menu (open qua hamburger button).
 *
 * Sauce Demo locators:
 *   - `~test-Menu` — hamburger button (top-left, all logged-in screens)
 *   - `~test-LOGOUT` — logout entry trong side menu
 *   - `~test-RESET APP STATE` — reset cart + state, useful giữa các test
 *   - `~test-Username` — login screen indicator (post-logout assert)
 */
import { $ } from '@wdio/globals';
import { waitForClickable, waitForVisible } from '../utils/wait';
import { logger } from '../utils/logger';

export class MenuPage {
  private readonly menuButton = '~test-Menu';
  private readonly logoutButton = '~test-LOGOUT';
  private readonly resetAppStateButton = '~test-RESET APP STATE';
  private readonly loginUsernameInput = '~test-Username';

  async open(): Promise<void> {
    await waitForClickable(this.menuButton, {
      description: 'Menu hamburger button',
    });
    await $(this.menuButton).click();
    await waitForVisible(this.logoutButton, {
      description: 'Side menu LOGOUT entry (menu opened)',
    });
    logger.info('MenuPage.open clicked');
  }

  async logout(): Promise<void> {
    await this.open();
    await waitForClickable(this.logoutButton, {
      description: 'Side menu LOGOUT button',
    });
    await $(this.logoutButton).click();
    await waitForVisible(this.loginUsernameInput, {
      description: 'Login screen username input (post-logout)',
      timeout: 15000,
    });
    logger.info('MenuPage.logout completed');
  }

  /**
   * RESET APP STATE — clear cart + reset internal flags. Hữu ích cho test
   * chain reuse same Appium session (vd. nightly suite chạy nhiều flow tuần
   * tự không restart app).
   */
  async resetAppState(): Promise<void> {
    await this.open();
    await waitForClickable(this.resetAppStateButton, {
      description: 'Side menu RESET APP STATE button',
    });
    await $(this.resetAppStateButton).click();
    logger.info('MenuPage.resetAppState clicked');
  }
}
