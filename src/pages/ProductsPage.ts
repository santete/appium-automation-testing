/**
 * ProductsPage — Sauce Labs Demo App products list (post-login landing).
 *
 * Pattern bắt buộc (spec §3 step 4a + §9.2):
 *   - Locator private + readonly, accessibility id `~test-*`.
 *   - Page Object KHÔNG chứa assertion (assert ở spec layer).
 *   - Action có wait điều kiện rõ ràng, không pause().
 *
 * Sauce Demo locator references:
 *   - `~test-Cart` — cart icon (post-login indicator + tap to navigate)
 *   - `~test-Item` — count badge nằm trong cart container; chỉ hiện khi >= 1
 *   - `~test-ADD TO CART` — button bên cạnh mỗi product (multi)
 *   - `~test-REMOVE` — button thay ADD TO CART sau khi đã add (multi)
 *   - `~test-Item title` — product title (multi); dùng để locate product card
 */
import { $, $$ } from '@wdio/globals';
import { waitForClickable, waitForVisible } from '../utils/wait';
import { logger } from '../utils/logger';

export class ProductsPage {
  private readonly cartIcon = '~test-Cart';
  private readonly cartBadge = '~test-Item';
  private readonly addToCartButton = '~test-ADD TO CART';
  private readonly removeButton = '~test-REMOVE';
  private readonly itemTitle = '~test-Item title';

  async waitForLoaded(): Promise<void> {
    await waitForVisible(this.cartIcon, {
      description: 'Products screen cart icon (post-login indicator)',
      timeout: 15000,
    });
  }

  /**
   * Add first product card có `~test-ADD TO CART` button visible. Sauce Demo
   * không expose product name qua accessibility id riêng → match-by-position
   * đủ cho smoke + regression scope.
   */
  async addFirstProduct(): Promise<void> {
    await waitForClickable(this.addToCartButton, {
      description: 'First ADD TO CART button',
    });
    const buttons = await $$(this.addToCartButton);
    const first = buttons[0];
    if (!first) throw new Error('No ADD TO CART button found on Products screen');
    await first.click();
    logger.info('ProductsPage.addFirstProduct clicked');
  }

  /**
   * Add N products (theo thứ tự xuất hiện). Sau mỗi click, button chuyển sang
   * REMOVE → next ADD TO CART trượt lên đầu danh sách → re-query mỗi vòng.
   */
  async addProducts(count: number): Promise<void> {
    if (count < 1) throw new Error(`addProducts: count must be >= 1, got ${count}`);
    for (let i = 0; i < count; i += 1) {
      await this.addFirstProduct();
    }
  }

  async openCart(): Promise<void> {
    await waitForClickable(this.cartIcon, {
      description: 'Cart icon to open cart screen',
    });
    await $(this.cartIcon).click();
    logger.info('ProductsPage.openCart clicked');
  }

  /**
   * Read cart badge count. Returns 0 nếu badge không visible (Sauce Demo ẩn
   * badge khi cart empty).
   */
  async getCartBadgeCount(): Promise<number> {
    const badge = await $(this.cartBadge);
    if (!(await badge.isExisting())) return 0;
    if (!(await badge.isDisplayed())) return 0;
    const text = await badge.getText();
    const n = parseInt(text.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  }

  async getVisibleItemTitles(): Promise<string[]> {
    const els = await $$(this.itemTitle);
    const texts: string[] = [];
    for (const el of els) {
      texts.push(await el.getText());
    }
    return texts;
  }

  async hasRemoveButton(): Promise<boolean> {
    const btn = await $(this.removeButton);
    if (!(await btn.isExisting())) return false;
    return btn.isDisplayed();
  }
}
