/**
 * Quarantine root hook plugin — Mocha beforeEach.
 *
 * Plan ref: M4 Task 8 + Decision 12.
 *
 * Hook đọc `docs/quarantine.yaml` ở init, build map test_id → entry. Mỗi
 * beforeEach:
 *   - Match `this.currentTest.fullTitle()` với entry.test_id.
 *   - Future deadline → `this.skip()` (Mocha pending; KHÔNG count fail).
 *   - Past deadline → throw → CI fail buộc fix hoặc extend grace.
 *
 * IMPORTANT — hook order: file này phải register **TRƯỚC**
 * `tests/_hooks/global.ts` trong `mochaOpts.require` (E2E configs) +
 * `.mocharc.*.cjs` require[]. Skip-before-lease tránh leak AccountPool slot
 * khi quarantine skip test.
 */
import * as path from 'node:path';
import {
  addDays,
  findEntry,
  isPastDeadline,
  loadQuarantine,
} from '../../src/utils/quarantine/loader';
import { QUARANTINE_MAX_DEADLINE_DAYS } from '../../src/utils/quarantine/schema';

const QUARANTINE_FILE = path.resolve(__dirname, '../../docs/quarantine.yaml');
const file = loadQuarantine(QUARANTINE_FILE);

export const mochaHooks = {
  beforeEach(this: Mocha.Context) {
    const testId = this.currentTest?.fullTitle();
    if (!testId) return;

    const entry = findEntry(testId, file);
    if (!entry) return;

    if (isPastDeadline(entry)) {
      const maxDeadline = addDays(entry.added, QUARANTINE_MAX_DEADLINE_DAYS);
      throw new Error(
        `Quarantine deadline expired for "${testId}": ` +
          `deadline=${entry.deadline} (added=${entry.added}, owner=${entry.owner}). ` +
          `Fix the test, hoặc extend grace ≤ ${maxDeadline} qua PR review. ` +
          `Reason: ${entry.reason}`,
      );
    }

    this.skip();
  },
};
