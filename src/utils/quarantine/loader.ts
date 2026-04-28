/**
 * Quarantine YAML loader + helpers.
 *
 * Plan ref: M4 Task 8.
 *
 * - `loadQuarantine(path)`: file missing → empty list (graceful — repo có thể
 *   chưa create file, không phá CI). Schema invalid → throw để CI fail.
 * - `findEntry(testId, file)`: lookup theo Mocha fullTitle() match.
 * - `isPastDeadline(entry, now?)`: strict greater-than — deadline=today vẫn
 *   skip; tomorrow throw. Tránh fail tại midnight rollover edge.
 * - `addDays(iso, days)`: UTC-safe date math cho schema refinement + grace
 *   extension hint trong error message.
 */
import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
import { QuarantineFileSchema, type QuarantineEntry, type QuarantineFile } from './schema';

export function loadQuarantine(filePath: string): QuarantineFile {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = yaml.load(raw);
  // Empty/null YAML → treat as empty list (file mới tạo còn comment-only).
  if (parsed === null || parsed === undefined) {
    return { entries: [] };
  }
  const result = QuarantineFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Quarantine file invalid (${filePath}):\n${issues}`);
  }
  return result.data;
}

export function findEntry(testId: string, file: QuarantineFile): QuarantineEntry | undefined {
  return file.entries.find((e) => e.test_id === testId);
}

export function isPastDeadline(entry: { deadline: string }, now: Date = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  return today > entry.deadline;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
