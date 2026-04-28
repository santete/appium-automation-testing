/**
 * Quarantine YAML schema — Zod-validated single source of truth.
 *
 * Plan ref: M4 Task 8 + Decision 10 (2 tuần default + 1 tuần grace; past →
 * CI fail) + Decision 12 (custom Mocha hook + YAML, KHÔNG dùng mocha-grep).
 */
import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required (vd. 2026-04-28)');

const MAX_DEADLINE_DAYS = 21; // 14 default + 7 grace

export const QuarantineEntrySchema = z
  .object({
    test_id: z.string().min(1, 'test_id phải match Mocha fullTitle() (vd. "Suite > Test name")'),
    reason: z.string().min(10, 'reason phải đủ dài để actionable (≥10 ký tự, link RCA/issue)'),
    added: isoDate,
    deadline: isoDate,
    owner: z.string().min(1, 'owner email/handle bắt buộc'),
  })
  .refine((e) => e.deadline >= e.added, {
    message: 'deadline phải >= added',
    path: ['deadline'],
  })
  .refine(
    (e) => {
      const added = new Date(e.added + 'T00:00:00Z').getTime();
      const deadline = new Date(e.deadline + 'T00:00:00Z').getTime();
      const days = Math.round((deadline - added) / (24 * 60 * 60 * 1000));
      return days <= MAX_DEADLINE_DAYS;
    },
    {
      message: `deadline tối đa = added + ${MAX_DEADLINE_DAYS} ngày (14 default + 7 grace)`,
      path: ['deadline'],
    },
  );

export const QuarantineFileSchema = z.object({
  entries: z.array(QuarantineEntrySchema),
});

export type QuarantineEntry = z.infer<typeof QuarantineEntrySchema>;
export type QuarantineFile = z.infer<typeof QuarantineFileSchema>;

export const QUARANTINE_MAX_DEADLINE_DAYS = MAX_DEADLINE_DAYS;
