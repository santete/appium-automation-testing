/**
 * CheckoutPage — Sauce Labs Demo App 3-step checkout flow.
 *
 * Step 1 (Information): First Name + Last Name + Postal Code → CONTINUE.
 * Step 2 (Overview): Item summary + total → FINISH.
 * Step 3 (Complete): "CHECKOUT: COMPLETE!" + BACK HOME.
 *
 * Sauce Demo locators:
 *   - `~test-First Name`, `~test-Last Name`, `~test-Zip/Postal Code` (step 1 inputs)
 *   - `~test-CONTINUE` (step 1 submit)
 *   - `~test-FINISH` (step 2 submit)
 *   - `~test-CANCEL` (step 1 + 2)
 *   - `~test-CHECKOUT: COMPLETE!` (step 3 success indicator)
 *   - `~test-BACK HOME` (step 3 back to products)
 *   - `~test-Error message` (step 1 error khi field empty)
 */
import { $ } from '@wdio/globals';
import { waitForClickable, waitForVisible } from '../utils/wait';
import { logger } from '../utils/logger';

export interface CheckoutInfo {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export class CheckoutPage {
  private readonly firstNameInput = '~test-First Name';
  private readonly lastNameInput = '~test-Last Name';
  private readonly postalCodeInput = '~test-Zip/Postal Code';
  private readonly continueButton = '~test-CONTINUE';
  private readonly finishButton = '~test-FINISH';
  private readonly cancelButton = '~test-CANCEL';
  private readonly completeIndicator = '~test-CHECKOUT: COMPLETE!';
  private readonly backHomeButton = '~test-BACK HOME';
  private readonly errorMessage = '~test-Error message';

  async waitForStep1(): Promise<void> {
    await waitForVisible(this.firstNameInput, {
      description: 'Checkout step 1 First Name input',
      timeout: 15000,
    });
  }

  async fillInfo(info: CheckoutInfo): Promise<void> {
    await this.waitForStep1();
    await $(this.firstNameInput).setValue(info.firstName);
    await $(this.lastNameInput).setValue(info.lastName);
    await $(this.postalCodeInput).setValue(info.postalCode);
    logger.info('CheckoutPage.fillInfo done', {
      firstName: info.firstName,
      lastName: info.lastName,
    });
  }

  async tapContinue(): Promise<void> {
    await waitForClickable(this.continueButton, {
      description: 'Checkout step 1 CONTINUE button',
    });
    await $(this.continueButton).click();
    logger.info('CheckoutPage.tapContinue clicked');
  }

  async tapFinish(): Promise<void> {
    await waitForClickable(this.finishButton, {
      description: 'Checkout step 2 FINISH button',
    });
    await $(this.finishButton).click();
    logger.info('CheckoutPage.tapFinish clicked');
  }

  async tapCancel(): Promise<void> {
    await waitForClickable(this.cancelButton, {
      description: 'Checkout CANCEL button',
    });
    await $(this.cancelButton).click();
    logger.info('CheckoutPage.tapCancel clicked');
  }

  async waitForComplete(): Promise<void> {
    await waitForVisible(this.completeIndicator, {
      description: 'Checkout step 3 CHECKOUT: COMPLETE! indicator',
      timeout: 15000,
    });
  }

  async tapBackHome(): Promise<void> {
    await waitForClickable(this.backHomeButton, {
      description: 'Checkout step 3 BACK HOME button',
    });
    await $(this.backHomeButton).click();
    logger.info('CheckoutPage.tapBackHome clicked');
  }

  async getError(): Promise<string | null> {
    const el = await $(this.errorMessage);
    if (!(await el.isExisting())) return null;
    if (!(await el.isDisplayed())) return null;
    return el.getText();
  }
}
