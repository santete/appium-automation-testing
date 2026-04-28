/**
 * Wait helpers — thay thế cho browser.pause() (bị cấm bởi ESLint, spec §3 step 4c).
 *
 * Tất cả wait BẮT BUỘC có `description` để emit timeoutMsg actionable khi fail.
 */
import { browser, $ } from '@wdio/globals';

const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_WAIT_TIMEOUT || '10000', 10);
const DEFAULT_INTERVAL = parseInt(process.env.DEFAULT_WAIT_INTERVAL || '500', 10);

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  description: string;
}

export async function waitFor(
  condition: () => Promise<boolean>,
  options: WaitOptions,
): Promise<void> {
  await browser.waitUntil(condition, {
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    interval: options.interval ?? DEFAULT_INTERVAL,
    timeoutMsg: `Wait failed: ${options.description} (timeout ${options.timeout ?? DEFAULT_TIMEOUT}ms)`,
  });
}

export async function waitForVisible(locator: string, options: WaitOptions): Promise<void> {
  await waitFor(
    async () => {
      const el = await $(locator);
      return el.isDisplayed();
    },
    {
      ...options,
      description: `${options.description} visible (locator: ${locator})`,
    },
  );
}

export async function waitForClickable(locator: string, options: WaitOptions): Promise<void> {
  await waitFor(
    async () => {
      const el = await $(locator);
      if (!(await el.isDisplayed())) return false;
      return el.isEnabled();
    },
    {
      ...options,
      description: `${options.description} clickable (locator: ${locator})`,
    },
  );
}

export async function waitForGone(locator: string, options: WaitOptions): Promise<void> {
  await waitFor(
    async () => {
      const el = await $(locator);
      const exists = await el.isExisting();
      if (!exists) return true;
      return !(await el.isDisplayed());
    },
    {
      ...options,
      description: `${options.description} gone (locator: ${locator})`,
    },
  );
}
