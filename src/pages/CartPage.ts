/**
 * CartPage — Sauce Labs Demo App cart screen.
 *
 * Sauce Demo cart locators:
 *   - `~test-Cart Content` — cart screen container (visible khi đứng trên cart)
 *   - `~test-CHECKOUT` — proceed-to-checkout button
 *   - `~test-CONTINUE SHOPPING` — back to products button
 *   - `~test-REMOVE` — remove item button (multi, theo từng item)
 *   - `~test-Item title` — item title (multi)
 *   - `~test-Price` — item price (multi)
 */
import { $, $$ } from '@wdio/globals';
import { waitForClickable, waitForVisible } from '../utils/wait';
import { logger } from '../utils/logger';

export class CartPage {
  private readonly container = '~test-Cart Content';
  private readonly checkoutButton = '~test-CHECKOUT';
  private readonly continueShoppingButton = '~test-CONTINUE SHOPPING';
  private readonly removeButton = '~test-REMOVE';
  private readonly itemTitle = '~test-Item title';

  async waitForLoaded(): Promise<void> {
    await waitForVisible(this.container, {
      description: 'Cart screen container',
      timeout: 15000,
    });
  }

  async listItemTitles(): Promise<string[]> {
    const els = await $$(this.itemTitle);
    const texts: string[] = [];
    for (const el of els) {
      texts.push(await el.getText());
    }
    return texts;
  }

  /**
   * Remove first item via REMOVE button. Sauce Demo cart re-renders sau click;
   * caller cần re-query nếu remove tiếp.
   */
  async removeFirstItem(): Promise<void> {
    const btns = await $$(this.removeButton);
    const first = btns[0];
    if (!first) throw new Error('No REMOVE button — cart empty?');
    await first.click();
    logger.info('CartPage.removeFirstItem clicked');
  }

  async tapCheckout(): Promise<void> {
    await waitForClickable(this.checkoutButton, {
      description: 'Cart CHECKOUT button',
    });
    await $(this.checkoutButton).click();
    logger.info('CartPage.tapCheckout clicked');
  }

  async tapContinueShopping(): Promise<void> {
    await waitForClickable(this.continueShoppingButton, {
      description: 'Cart CONTINUE SHOPPING button',
    });
    await $(this.continueShoppingButton).click();
    logger.info('CartPage.tapContinueShopping clicked');
  }

  async hasItems(): Promise<boolean> {
    const els = await $$(this.removeButton);
    return els.length > 0;
  }
}
