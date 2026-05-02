/**
 * Visual regression comparator — pure-JS pixelmatch + pngjs.
 *
 * Spec ref: §1.2 (visual regression — reactive stabilize), §10 tech stack.
 * Plan ref: M6 Task 2.
 *
 * Why pixelmatch (pivot từ resemblejs):
 *   resemblejs v5 yêu cầu native `canvas` module trên Node → cần build
 *   tooling Windows (node-gyp + Visual Studio Build Tools). pixelmatch là
 *   pure JS chạy trên pngjs → zero-native-dep, install reliably across CI
 *   matrix. Decision row "M6 D1 pivot" log in ROADMAP.
 *
 * Design:
 *   - Pure function: input 2 PNG buffers + options → `MismatchResult`.
 *   - Tolerance: caller chỉ định `mismatchThresholdPct` (% pixel khác trên
 *     tổng pixel; default 0.5%).
 *   - Anti-flake: pixelmatch `threshold` (per-pixel sensitivity, 0-1, default
 *     0.1) + `includeAA` flag. Anti-aliased pixels được skip mặc định.
 *   - Ignore regions (rectangles) — clear pixel màu trung lập trong cả 2
 *     buffer trước khi diff (pixelmatch không có ignored-box native).
 *   - Diff PNG buffer trả về để Allure attach.
 */
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface IgnoreRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CompareOptions {
  /** Max mismatch % (0-100). Default 0.5%. */
  mismatchThresholdPct?: number;
  /** Pixel rectangles bỏ qua (vd. clock, dynamic banner). */
  ignoreRegions?: IgnoreRegion[];
  /** pixelmatch per-pixel threshold (0-1). Default 0.1. */
  pixelThreshold?: number;
  /** Diff anti-aliased pixels (default false → skip AA pixel). */
  includeAA?: boolean;
  /** Set true để treat 2 image với size khác nhau là mismatch ngay. Default true. */
  failOnDimensionMismatch?: boolean;
}

export interface MismatchResult {
  /** Mismatched pixels / total pixels × 100. */
  mismatchPct: number;
  /** True khi mismatchPct ≤ threshold (PASS). */
  withinThreshold: boolean;
  thresholdPct: number;
  /** PNG buffer của diff image. Empty khi withinThreshold. */
  diffBuffer: Buffer;
  baselineWidth: number;
  baselineHeight: number;
  actualWidth: number;
  actualHeight: number;
  /** Mismatched pixel count. */
  mismatchedPixels: number;
  totalPixels: number;
}

function readPng(buf: Buffer): PNG {
  return PNG.sync.read(buf);
}

function clearRegions(png: PNG, regions: readonly IgnoreRegion[]): void {
  for (const r of regions) {
    const left = Math.max(0, r.left);
    const top = Math.max(0, r.top);
    const right = Math.min(png.width, r.right);
    const bottom = Math.min(png.height, r.bottom);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const idx = (png.width * y + x) * 4;
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 255;
      }
    }
  }
}

export function compareImage(
  baseline: Buffer,
  actual: Buffer,
  options: CompareOptions = {},
): Promise<MismatchResult> {
  const threshold = options.mismatchThresholdPct ?? 0.5;
  const failOnDim = options.failOnDimensionMismatch ?? true;
  const pixelThreshold = options.pixelThreshold ?? 0.1;
  const includeAA = options.includeAA ?? false;

  const basePng = readPng(baseline);
  const actPng = readPng(actual);

  if (failOnDim && (basePng.width !== actPng.width || basePng.height !== actPng.height)) {
    return Promise.resolve({
      mismatchPct: 100,
      withinThreshold: false,
      thresholdPct: threshold,
      diffBuffer: Buffer.alloc(0),
      baselineWidth: basePng.width,
      baselineHeight: basePng.height,
      actualWidth: actPng.width,
      actualHeight: actPng.height,
      mismatchedPixels: basePng.width * basePng.height,
      totalPixels: basePng.width * basePng.height,
    });
  }

  if (options.ignoreRegions && options.ignoreRegions.length > 0) {
    clearRegions(basePng, options.ignoreRegions);
    clearRegions(actPng, options.ignoreRegions);
  }

  const { width, height } = basePng;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(basePng.data, actPng.data, diff.data, width, height, {
    threshold: pixelThreshold,
    includeAA,
  });
  const total = width * height;
  const pct = (mismatched / total) * 100;
  const within = pct <= threshold;

  return Promise.resolve({
    mismatchPct: pct,
    withinThreshold: within,
    thresholdPct: threshold,
    diffBuffer: within ? Buffer.alloc(0) : PNG.sync.write(diff),
    baselineWidth: basePng.width,
    baselineHeight: basePng.height,
    actualWidth: actPng.width,
    actualHeight: actPng.height,
    mismatchedPixels: mismatched,
    totalPixels: total,
  });
}
