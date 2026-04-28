/**
 * Runtime adapter — bind WDIO global `$` vào `UiCheckerDeps.find`.
 *
 * Tách khỏi `UiChecker.ts` để unit test KHÔNG cần load WDIO globals.
 * Production code dùng adapter này; tests inject mock `UiCheckerDeps` trực tiếp.
 */
import type { UiCheckerDeps, UiElement } from './UiChecker';

export const wdioUiCheckerDeps: UiCheckerDeps = {
  async find(locator: string): Promise<UiElement> {
    // WDIO `$` là global khi chạy trong test runner. Cast tối thiểu — không
    // gói thêm logic ở đây, mọi quyết định ở UiChecker.
    return $(locator) as unknown as UiElement;
  },
};
