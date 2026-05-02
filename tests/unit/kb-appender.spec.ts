/**
 * Unit tests cho KB auto-appender (M5 Task 7).
 *
 * Cover:
 *  - Confidence gate: < 0.85 → skip; ≥ 0.85 → append.
 *  - `force: true` → bypass gate.
 *  - Throw khi file không tồn tại.
 *  - Throw khi file thiếu marker.
 *  - Insert đúng vị trí (sau marker, trước existing entries nếu có).
 *  - Entry ID seq: ngày trống → 001; có 002 → 003.
 *  - Dedup window 24h: cùng (testId, matchedRule, pattern) trong 23h59m → skip;
 *    quá 24h → append; khác testId → append; khác rule → append.
 *  - Manual content (Remediation đã edit) preserve khi append entry mới.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { appendKbEntry } from '../../src/utils/kb/appender';
import type { FailureClassification } from '../../src/utils/classifier/types';

const SKELETON = [
  '# Failure Knowledge Base (KB)',
  '',
  '> Test skeleton.',
  '',
  '<!-- KB_ENTRIES_BELOW — appender insert entry mới ngay sau marker này -->',
  '',
].join('\n');

function makeClassification(over: Partial<FailureClassification> = {}): FailureClassification {
  return {
    testId: 'TC_LOGIN_001',
    category: 'BUG',
    layer: 'API',
    reproducible: true,
    reproductionRate: 1.0,
    routeTo: 1,
    assignTo: 'dev_team',
    priority: 'P0',
    rootCause: {
      description: 'API trả 500 trên endpoint /login',
      evidence: ['logs/run-1.log:42', 'screenshot.png'],
    },
    confidence: 0.9,
    matchedRule: 'bug:api-5xx',
    ...over,
  };
}

function tmpKb(initial = SKELETON): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-'));
  const file = path.join(dir, 'flaky_kb.md');
  fs.writeFileSync(file, initial, 'utf-8');
  return file;
}

describe('KB appender — confidence gate', () => {
  it('confidence < 0.85 → skip', async () => {
    const file = tmpKb();
    const result = await appendKbEntry(makeClassification({ confidence: 0.7 }), { kbPath: file });
    expect(result.appended).to.equal(false);
    expect(result.reason).to.equal('low-confidence');
    expect(fs.readFileSync(file, 'utf-8')).to.equal(SKELETON);
  });

  it('confidence ≥ 0.85 → append', async () => {
    const file = tmpKb();
    const result = await appendKbEntry(makeClassification({ confidence: 0.85 }), { kbPath: file });
    expect(result.appended).to.equal(true);
    expect(result.entryId).to.match(/^KB-\d{8}-001$/);
    expect(fs.readFileSync(file, 'utf-8')).to.contain('TC_LOGIN_001');
  });

  it('force: true bypass gate', async () => {
    const file = tmpKb();
    const result = await appendKbEntry(makeClassification({ confidence: 0.1 }), {
      kbPath: file,
      force: true,
    });
    expect(result.appended).to.equal(true);
  });

  it('confidenceGate override', async () => {
    const file = tmpKb();
    const result = await appendKbEntry(makeClassification({ confidence: 0.7 }), {
      kbPath: file,
      confidenceGate: 0.5,
    });
    expect(result.appended).to.equal(true);
  });
});

describe('KB appender — file structure validation', () => {
  it('file không tồn tại → throw', async () => {
    let err: Error | null = null;
    try {
      await appendKbEntry(makeClassification(), { kbPath: '/nonexistent/path/kb.md' });
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.not.equal(null);
    expect(err!.message).to.contain('không tồn tại');
  });

  it('file thiếu marker → throw', async () => {
    const file = tmpKb('# KB\n\nNo marker here.\n');
    let err: Error | null = null;
    try {
      await appendKbEntry(makeClassification(), { kbPath: file });
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.not.equal(null);
    expect(err!.message).to.contain('thiếu marker');
  });
});

describe('KB appender — entry ID + insert position', () => {
  it('skeleton trống → seq 001', async () => {
    const file = tmpKb();
    const r = await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    expect(r.entryId).to.equal('KB-20260429-001');
  });

  it('cùng ngày đã có 002 → seq 003', async () => {
    const file = tmpKb(`${SKELETON}\n\n### KB-20260429-001 — old\n\n### KB-20260429-002 — old\n`);
    const r = await appendKbEntry(makeClassification({ testId: 'TC_OTHER' }), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    expect(r.entryId).to.equal('KB-20260429-003');
  });

  it('insert ngay sau marker, trước existing entries', async () => {
    const existing = `${SKELETON}\n\n### KB-20260101-001 — old entry\n\nstuff\n`;
    const file = tmpKb(existing);
    await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    const out = fs.readFileSync(file, 'utf-8');
    const newIdx = out.indexOf('KB-20260429-001');
    const oldIdx = out.indexOf('KB-20260101-001');
    expect(newIdx).to.be.greaterThan(0);
    expect(newIdx).to.be.lessThan(oldIdx);
  });

  it('preserve manual content trong entry cũ', async () => {
    const manual = `${SKELETON}\n\n### KB-20260101-001 — old\n\n**Remediation:**\nfixed bằng commit abc123\n`;
    const file = tmpKb(manual);
    await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    expect(fs.readFileSync(file, 'utf-8')).to.contain('fixed bằng commit abc123');
  });
});

describe('KB appender — dedup window 24h', () => {
  it('cùng testId + rule + pattern trong 23h → skip', async () => {
    const file = tmpKb();
    await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    const r = await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-30T08:00:00Z'),
    });
    expect(r.appended).to.equal(false);
    expect(r.reason).to.equal('duplicate-24h');
  });

  it('cùng testId nhưng quá 24h → append', async () => {
    const file = tmpKb();
    await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    const r = await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-30T11:00:00Z'),
    });
    expect(r.appended).to.equal(true);
  });

  it('khác testId trong window → append', async () => {
    const file = tmpKb();
    await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    const r = await appendKbEntry(makeClassification({ testId: 'TC_OTHER' }), {
      kbPath: file,
      now: new Date('2026-04-29T11:00:00Z'),
    });
    expect(r.appended).to.equal(true);
  });

  it('khác matchedRule trong window → append', async () => {
    const file = tmpKb();
    await appendKbEntry(makeClassification(), {
      kbPath: file,
      now: new Date('2026-04-29T10:00:00Z'),
    });
    const r = await appendKbEntry(makeClassification({ matchedRule: 'bug:perf-regression' }), {
      kbPath: file,
      now: new Date('2026-04-29T11:00:00Z'),
    });
    expect(r.appended).to.equal(true);
  });
});
