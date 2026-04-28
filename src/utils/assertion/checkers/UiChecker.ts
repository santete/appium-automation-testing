/**
 * UiChecker — execute UI-layer assertions từ contract.
 *
 * Spec ref: §5.4 (UI layer), §6 (multi-layer validation).
 * Plan ref: M2 Task 3, Decision §4.D8 (no-eval, type registry).
 *
 * Design: dependency injection cho `find` adapter — runtime inject WDIO `$()`,
 * unit test inject mock. Không gọi global `$` / `browser` trực tiếp để tách
 * checker khỏi WDIO runtime (testable).
 *
 * Mỗi `UiCheck.type` map 1-1 vào 1 case trong `switch` — thêm type mới =
 * thêm Zod variant (`_schema.ts`) + 1 case ở đây (intentional friction).
 */
import type { UiCheck } from '../../../contracts/_schema';
import type { CheckOutcome } from '../types';

/**
 * Element interface mà UiChecker cần. Subset của WDIO `Element` để dễ mock
 * trong unit test. Runtime adapter (`wdioUiCheckerDeps`) wraps WDIO element.
 */
export interface UiElement {
  isDisplayed(): Promise<boolean>;
  isExisting(): Promise<boolean>;
  getText(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
}

export interface UiCheckerDeps {
  /** Resolve locator string → element handle. KHÔNG throw nếu không tìm thấy. */
  find: (locator: string) => Promise<UiElement>;
}

export class UiChecker {
  constructor(private readonly deps: UiCheckerDeps) {}

  async run(check: UiCheck): Promise<CheckOutcome> {
    switch (check.type) {
      case 'element_visible':
        return this.elementVisible(check.locator);
      case 'element_absent':
        return this.elementAbsent(check.locator);
      case 'text_equals':
        return this.textEquals(check.locator, check.expected);
      case 'attribute_match':
        return this.attributeMatch(check.locator, check.attribute, check.regex);
    }
  }

  private async elementVisible(locator: string): Promise<CheckOutcome> {
    try {
      const el = await this.deps.find(locator);
      const visible = await el.isDisplayed();
      if (visible) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `expected element visible: ${locator}`,
        evidence: [],
      };
    } catch (err) {
      return {
        passed: false,
        message: `element_visible error on ${locator}: ${errMsg(err)}`,
        evidence: [],
      };
    }
  }

  private async elementAbsent(locator: string): Promise<CheckOutcome> {
    try {
      const el = await this.deps.find(locator);
      const exists = await el.isExisting();
      if (!exists) return { passed: true, evidence: [] };
      const visible = await el.isDisplayed().catch(() => false);
      if (!visible) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `expected element absent but found: ${locator}`,
        evidence: [],
      };
    } catch {
      // find() failed → coi như absent (locator không match gì).
      return { passed: true, evidence: [] };
    }
  }

  private async textEquals(locator: string, expected: string): Promise<CheckOutcome> {
    try {
      const el = await this.deps.find(locator);
      const actual = await el.getText();
      if (actual === expected) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `text_equals on ${locator}: expected "${expected}", got "${actual}"`,
        evidence: [],
      };
    } catch (err) {
      return {
        passed: false,
        message: `text_equals error on ${locator}: ${errMsg(err)}`,
        evidence: [],
      };
    }
  }

  private async attributeMatch(
    locator: string,
    attribute: string,
    regex: string,
  ): Promise<CheckOutcome> {
    let pattern: RegExp;
    try {
      pattern = new RegExp(regex);
    } catch (err) {
      return {
        passed: false,
        message: `attribute_match invalid regex "${regex}": ${errMsg(err)}`,
        evidence: [],
      };
    }
    try {
      const el = await this.deps.find(locator);
      const actual = await el.getAttribute(attribute);
      if (actual !== null && pattern.test(actual)) return { passed: true, evidence: [] };
      return {
        passed: false,
        message: `attribute_match on ${locator}[@${attribute}]: expected /${regex}/, got ${actual === null ? '<null>' : `"${actual}"`}`,
        evidence: [],
      };
    } catch (err) {
      return {
        passed: false,
        message: `attribute_match error on ${locator}[@${attribute}]: ${errMsg(err)}`,
        evidence: [],
      };
    }
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
