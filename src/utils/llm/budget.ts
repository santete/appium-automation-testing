/**
 * LLM monthly spend tracker. Reuse `proper-lockfile` pattern từ M3
 * AccountPool để cross-process safe (CI parallel + local dev share file).
 *
 * State shape:
 *   { month: '2026-04', totalUsd: number, lastUpdated: ISO8601 }
 *
 * Reset: khi `month` field khác current month → reset totalUsd = 0.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import lockfile from 'proper-lockfile';
import { z } from 'zod';
import { LlmBudgetExceededError } from './types';
import { logger } from '../logger';

const SpendStateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalUsd: z.number().nonnegative(),
  lastUpdated: z.string(),
});
type SpendState = z.infer<typeof SpendStateSchema>;

export interface BudgetTrackerOptions {
  statePath: string;
  budgetMonthlyUsd: number;
  /** Override clock cho unit test (default Date.now). */
  now?: () => Date;
}

export class LlmBudgetTracker {
  private readonly statePath: string;
  private readonly budgetUsd: number;
  private readonly now: () => Date;

  constructor(opts: BudgetTrackerOptions) {
    this.statePath = path.resolve(opts.statePath);
    this.budgetUsd = opts.budgetMonthlyUsd;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Atomic check + record spend. Throw `LlmBudgetExceededError` nếu thêm
   * `costUsd` sẽ vượt budget — KHÔNG record nếu vượt.
   */
  async record(costUsd: number): Promise<void> {
    if (costUsd < 0) throw new Error(`record: costUsd must be >= 0, got ${costUsd}`);

    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.statePath)) {
      fs.writeFileSync(this.statePath, JSON.stringify(this.emptyState(), null, 2));
    }

    const release = await lockfile.lock(this.statePath, {
      retries: { retries: 5, minTimeout: 50 },
    });
    try {
      const state = this.readState();
      const newTotal = state.totalUsd + costUsd;
      if (newTotal > this.budgetUsd) {
        throw new LlmBudgetExceededError(
          `LLM monthly budget exceeded: would total $${newTotal.toFixed(4)} > cap $${this.budgetUsd}`,
          state.totalUsd,
          this.budgetUsd,
        );
      }
      const updated: SpendState = {
        month: state.month,
        totalUsd: newTotal,
        lastUpdated: this.now().toISOString(),
      };
      fs.writeFileSync(this.statePath, JSON.stringify(updated, null, 2));
      logger.info('LLM spend recorded', { costUsd, totalUsd: newTotal });
    } finally {
      await release();
    }
  }

  /** Current month spend (read-only). Auto-reset nếu month mismatch. */
  async getCurrentSpend(): Promise<{ month: string; totalUsd: number; budgetUsd: number }> {
    if (!fs.existsSync(this.statePath)) {
      const empty = this.emptyState();
      return { month: empty.month, totalUsd: 0, budgetUsd: this.budgetUsd };
    }
    const state = this.readState();
    return { month: state.month, totalUsd: state.totalUsd, budgetUsd: this.budgetUsd };
  }

  private readState(): SpendState {
    const raw = fs.readFileSync(this.statePath, 'utf8');
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      logger.warn('LLM spend state malformed JSON → reset', { error: (e as Error).message });
      return this.emptyState();
    }
    const parsed = SpendStateSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn('LLM spend state invalid → reset', { issues: parsed.error.issues });
      return this.emptyState();
    }
    const currentMonth = this.formatMonth(this.now());
    if (parsed.data.month !== currentMonth) {
      logger.info('LLM spend month rolled over → reset', {
        old: parsed.data.month,
        new: currentMonth,
      });
      return this.emptyState();
    }
    return parsed.data;
  }

  private emptyState(): SpendState {
    return {
      month: this.formatMonth(this.now()),
      totalUsd: 0,
      lastUpdated: this.now().toISOString(),
    };
  }

  private formatMonth(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }
}
