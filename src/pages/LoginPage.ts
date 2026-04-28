/**
 * LoginPage — Page Object cho Sauce Labs Demo App login screen.
 *
 * Pattern bắt buộc (spec §3 step 4a + §9.2):
 *   - Locator private + readonly, dùng accessibility id (~test-*)
 *   - Page Object KHÔNG chứa assertion (assert ở spec layer)
 *   - Mọi action có wait điều kiện rõ ràng, không pause()
 */
import { $ } from '@wdio/globals';
import { waitForVisible, waitForClickable } from '../utils/wait';
import { logger } from '../utils/logger';

export class LoginPage {
  private readonly usernameInput = '~test-Username';
  private readonly passwordInput = '~test-Password';
  private readonly loginButton = '~test-LOGIN';
  private readonly errorMessage = '~test-Error message';

  async waitForLoaded(): Promise<void> {
    await waitForVisible(this.usernameInput, {
      description: 'Login screen username input',
    });
  }

  async login(username: string, password: string): Promise<void> {
    logger.info('Login flow started', { username });

    await this.waitForLoaded();

    await $(this.usernameInput).setValue(username);
    await $(this.passwordInput).setValue(password);

    await waitForClickable(this.loginButton, {
      description: 'Login submit button',
    });
    await $(this.loginButton).click();

    logger.info('Login form submitted');
  }

  async getErrorMessage(): Promise<string | null> {
    const el = await $(this.errorMessage);
    if (!(await el.isExisting())) return null;
    if (!(await el.isDisplayed())) return null;
    return el.getText();
  }
}
