/**
 * Baseline store — đọc/ghi PNG baseline cho visual regression.
 *
 * Layout:
 *   tests/fixtures/visual/baselines/<screenId>.png  ← committed (golden)
 *   reports/visual/actual/<screenId>.png            ← runtime capture
 *   reports/visual/diff/<screenId>.png              ← diff image (Allure attach)
 *
 * Update flow:
 *   - Set env `VISUAL_UPDATE_BASELINES=1` → spec ghi đè baseline thay vì diff.
 *     Mode review: dev chạy 1 lần khi UI thay đổi cố ý → commit baseline mới.
 *   - Default (env unset) → diff + assert.
 *
 * Plan ref: M6 Task 2 — visual regression.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BaselineStoreConfig {
  baselinesDir: string;
  actualDir: string;
  diffDir: string;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');

export function defaultBaselineStoreConfig(): BaselineStoreConfig {
  return {
    baselinesDir: path.join(REPO_ROOT, 'tests/fixtures/visual/baselines'),
    actualDir: path.join(REPO_ROOT, 'reports/visual/actual'),
    diffDir: path.join(REPO_ROOT, 'reports/visual/diff'),
  };
}

export class BaselineStore {
  constructor(private readonly config: BaselineStoreConfig = defaultBaselineStoreConfig()) {}

  hasBaseline(screenId: string): boolean {
    return fs.existsSync(this.baselinePath(screenId));
  }

  readBaseline(screenId: string): Buffer {
    return fs.readFileSync(this.baselinePath(screenId));
  }

  writeBaseline(screenId: string, png: Buffer): void {
    this.ensureDir(this.config.baselinesDir);
    fs.writeFileSync(this.baselinePath(screenId), png);
  }

  writeActual(screenId: string, png: Buffer): void {
    this.ensureDir(this.config.actualDir);
    fs.writeFileSync(this.actualPath(screenId), png);
  }

  writeDiff(screenId: string, png: Buffer): void {
    this.ensureDir(this.config.diffDir);
    fs.writeFileSync(this.diffPath(screenId), png);
  }

  baselinePath(screenId: string): string {
    return path.join(this.config.baselinesDir, `${screenId}.png`);
  }

  actualPath(screenId: string): string {
    return path.join(this.config.actualDir, `${screenId}.png`);
  }

  diffPath(screenId: string): string {
    return path.join(this.config.diffDir, `${screenId}.png`);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function isUpdateMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VISUAL_UPDATE_BASELINES === '1' || env.VISUAL_UPDATE_BASELINES === 'true';
}
