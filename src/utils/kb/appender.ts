/**
 * KB auto-appender — append 1 entry vào `docs/flaky_kb.md` từ classifier output.
 *
 * M5 Task 7 deliverable. Plan ref: `docs/plans/M5-observability.md`
 * Decision 3 (markdown storage) + acceptance §2 sub-point 3.
 *
 * Contract:
 *  - Input: `FailureClassification` (Task 1 output) + optional `evidenceFiles`.
 *  - Output: append entry block sau marker `<!-- KB_ENTRIES_BELOW -->`.
 *  - **Idempotent (24h window):** dedup theo (testId, matchedRule, rootCause.
 *    description) — re-append cùng failure trong day → skip + log.
 *  - **Confidence gate:** entry < 0.85 → skip (caller có thể override qua
 *    `force: true`). Reason: noisy entry pollute KB; tin cao đủ mới ghi.
 *  - **File create-on-miss:** nếu `flaky_kb.md` chưa tồn tại → throw, vì
 *    skeleton phải human-curated (header, schema doc).
 *
 * Manual sections (`Remediation:`, `Links:`) chỉ skeleton — appender KHÔNG
 * overwrite khi entry đã tồn tại từ trước.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import lockfile from 'proper-lockfile';
import { logger } from '../logger';
import type { FailureClassification } from '../classifier/types';

const ENTRIES_MARKER = '<!-- KB_ENTRIES_BELOW — appender insert entry mới ngay sau marker này -->';
const DEDUP_WINDOW_HOURS = 24;
const DEFAULT_CONFIDENCE_GATE = 0.85;

export interface KbAppendOptions {
  /** Path tới `flaky_kb.md`. Default `docs/flaky_kb.md` từ cwd. */
  kbPath?: string;
  /** Bypass confidence gate (vd. test). Default false. */
  force?: boolean;
  /** Override confidence gate value. */
  confidenceGate?: number;
  /** Override "now" cho test reproducible. */
  now?: Date;
}

export interface KbAppendResult {
  appended: boolean;
  entryId?: string;
  reason?: 'low-confidence' | 'duplicate-24h';
}

/**
 * Append 1 entry. Trả `{appended: true, entryId}` khi success;
 * `{appended: false, reason}` khi skip.
 *
 * Throws nếu:
 *  - File `kbPath` không tồn tại.
 *  - File không chứa marker `<!-- KB_ENTRIES_BELOW -->`.
 */
export async function appendKbEntry(
  classification: FailureClassification,
  options: KbAppendOptions = {},
): Promise<KbAppendResult> {
  const kbPath = options.kbPath ?? path.resolve(process.cwd(), 'docs/flaky_kb.md');
  const gate = options.confidenceGate ?? DEFAULT_CONFIDENCE_GATE;
  const now = options.now ?? new Date();

  if (!options.force && classification.confidence < gate) {
    logger.info('KB skip — confidence dưới gate', {
      testId: classification.testId,
      confidence: classification.confidence,
      gate,
    });
    return { appended: false, reason: 'low-confidence' };
  }

  if (!fs.existsSync(kbPath)) {
    throw new Error(
      `KB file không tồn tại: ${kbPath} — tạo skeleton từ docs/flaky_kb.md mẫu trước.`,
    );
  }

  const release = await lockfile.lock(kbPath, { retries: { retries: 5, minTimeout: 50 } });
  try {
    const raw = fs.readFileSync(kbPath, 'utf-8');
    const markerIdx = raw.indexOf(ENTRIES_MARKER);
    if (markerIdx === -1) {
      throw new Error(`KB file thiếu marker "${ENTRIES_MARKER}" — không append được.`);
    }

    if (isDuplicateWithinWindow(raw, classification, now)) {
      logger.info('KB skip — duplicate trong window 24h', {
        testId: classification.testId,
        matchedRule: classification.matchedRule,
      });
      return { appended: false, reason: 'duplicate-24h' };
    }

    const entryId = nextEntryId(raw, now);
    const block = renderEntry(entryId, classification, now);

    const before = raw.slice(0, markerIdx + ENTRIES_MARKER.length);
    const after = raw.slice(markerIdx + ENTRIES_MARKER.length);
    const next = `${before}\n\n${block}${after.startsWith('\n') ? after : `\n${after}`}`;
    fs.writeFileSync(kbPath, next, 'utf-8');

    logger.info('KB entry appended', { entryId, testId: classification.testId });
    return { appended: true, entryId };
  } finally {
    await release();
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function ymd(now: Date): string {
  return `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
}

function nextEntryId(raw: string, now: Date): string {
  const today = ymd(now);
  const re = new RegExp(`KB-${today}-(\\d{3})`, 'g');
  let max = 0;
  for (const match of raw.matchAll(re)) {
    const n = parseInt(match[1], 10);
    if (n > max) max = n;
  }
  return `KB-${today}-${(max + 1).toString().padStart(3, '0')}`;
}

/**
 * Dedup check: parse entry headers + Created timestamp, so testId +
 * matchedRule + pattern. Entry trong window 24h từ `now` mà match → duplicate.
 *
 * Implementation đơn giản: regex extract `### KB-...` block + Created field +
 * Test ID field + matchedRule field + Pattern field. Không cần full parse.
 */
function isDuplicateWithinWindow(raw: string, c: FailureClassification, now: Date): boolean {
  const cutoff = now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000;
  const blocks = raw.split(/^### KB-/m).slice(1);
  for (const block of blocks) {
    const createdMatch = block.match(/Created\s*\|\s*([0-9T:\-\s]+UTC)/);
    const testIdMatch = block.match(/Test ID\s*\|\s*([^\s|]+)/);
    const ruleMatch = block.match(/Matched rule\s*\|\s*([^\s|]+)/);
    if (!createdMatch || !testIdMatch || !ruleMatch) continue;

    const createdAt = parseUtcStamp(createdMatch[1].trim());
    if (createdAt === null || createdAt < cutoff) continue;

    if (testIdMatch[1].trim() !== c.testId) continue;
    if (ruleMatch[1].trim() !== c.matchedRule) continue;

    const patternMatch = block.match(/\*\*Pattern:\*\*\s*\n([^\n]+)/);
    if (patternMatch && patternMatch[1].trim() === c.rootCause.description.trim()) {
      return true;
    }
  }
  return false;
}

function parseUtcStamp(stamp: string): number | null {
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+UTC$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function formatStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())} ` +
    `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(now.getUTCSeconds())} UTC`
  );
}

function renderEntry(id: string, c: FailureClassification, now: Date): string {
  const evidenceLines = c.rootCause.evidence.length
    ? c.rootCause.evidence.map((e) => `- ${e}`).join('\n')
    : '- _(no evidence captured)_';
  const shortTitle = c.rootCause.description.split('\n')[0].slice(0, 80);
  return [
    `### ${id} — ${shortTitle}`,
    '',
    '| Field        | Value                                       |',
    '|--------------|---------------------------------------------|',
    `| Created      | ${formatStamp(now)} |`,
    `| Test ID      | ${c.testId} |`,
    `| Category     | ${c.category} |`,
    `| Layer        | ${c.layer} |`,
    `| Confidence   | ${c.confidence.toFixed(2)} |`,
    `| Matched rule | ${c.matchedRule} |`,
    `| Route to     | step ${c.routeTo} |`,
    `| Assign to    | ${c.assignTo} |`,
    `| Priority     | ${c.priority} |`,
    `| Reproducible | ${c.reproducible} |`,
    `| Repro rate   | ${c.reproductionRate.toFixed(2)} |`,
    '',
    '**Pattern:**',
    c.rootCause.description,
    '',
    '**Evidence:**',
    evidenceLines,
    '',
    '**Remediation:**',
    '_(pending — fill khi fix landed)_',
    '',
    '**Links:**',
    '- RCA: _(pending)_',
    '- PR fix: _(pending)_',
    '',
    '---',
    '',
  ].join('\n');
}
