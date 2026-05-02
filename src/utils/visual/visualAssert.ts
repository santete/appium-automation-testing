/**
 * visualAssert — runtime API cho spec.
 *
 *   await visualAssert(driver, 'login_screen', { mismatchThresholdPct: 0.5 });
 *
 * Behavior:
 *  - Capture screenshot từ driver (`takeScreenshot()` returns base64 PNG).
 *  - Update mode (env VISUAL_UPDATE_BASELINES=1): ghi baseline + skip compare.
 *  - Default mode:
 *      - missing baseline → throw → CI prompt dev capture lần đầu.
 *      - else: compare → withinThreshold OK; else throw + write diff PNG.
 *  - Allure attach hook injected qua param `attach`.
 *
 * Plan ref: M6 Task 2.
 */
import { compareImage, type CompareOptions, type MismatchResult } from './compareImage';
import { BaselineStore, isUpdateMode } from './baselineStore';

export interface ScreenshotProvider {
  takeScreenshot(): Promise<string>;
}

export interface AllureAttacher {
  attach(name: string, content: Buffer | string, mime: string): void;
}

export interface VisualAssertOptions extends CompareOptions {
  store?: BaselineStore;
  /** Allure attacher; nếu undefined → skip attach. */
  allure?: AllureAttacher;
  /** Override env check (test). */
  updateMode?: boolean;
}

export interface VisualAssertResult {
  screenId: string;
  mode: 'updated' | 'compared';
  comparison?: MismatchResult;
}

export async function visualAssert(
  driver: ScreenshotProvider,
  screenId: string,
  options: VisualAssertOptions = {},
): Promise<VisualAssertResult> {
  const store = options.store ?? new BaselineStore();
  const update = options.updateMode ?? isUpdateMode();

  const screenshotB64 = await driver.takeScreenshot();
  const actual = Buffer.from(screenshotB64, 'base64');
  store.writeActual(screenId, actual);
  options.allure?.attach(`actual-${screenId}.png`, actual, 'image/png');

  if (update) {
    store.writeBaseline(screenId, actual);
    return { screenId, mode: 'updated' };
  }

  if (!store.hasBaseline(screenId)) {
    throw new Error(
      `visualAssert[${screenId}]: baseline missing at ${store.baselinePath(screenId)}. ` +
        `Run with VISUAL_UPDATE_BASELINES=1 to capture, then commit baseline.`,
    );
  }

  const baseline = store.readBaseline(screenId);
  options.allure?.attach(`baseline-${screenId}.png`, baseline, 'image/png');

  const comparison = await compareImage(baseline, actual, {
    mismatchThresholdPct: options.mismatchThresholdPct,
    ignoreRegions: options.ignoreRegions,
    pixelThreshold: options.pixelThreshold,
    includeAA: options.includeAA,
    failOnDimensionMismatch: options.failOnDimensionMismatch,
  });

  if (!comparison.withinThreshold && comparison.diffBuffer.length > 0) {
    store.writeDiff(screenId, comparison.diffBuffer);
    options.allure?.attach(`diff-${screenId}.png`, comparison.diffBuffer, 'image/png');
  }

  if (!comparison.withinThreshold) {
    throw new Error(
      `visualAssert[${screenId}]: mismatch ${comparison.mismatchPct.toFixed(3)}% > ` +
        `threshold ${comparison.thresholdPct}% (baseline=${comparison.baselineWidth}x${comparison.baselineHeight}, ` +
        `actual=${comparison.actualWidth}x${comparison.actualHeight}).`,
    );
  }

  return { screenId, mode: 'compared', comparison };
}
