/**
 * Unit tests cho quarantine schema + loader.
 *
 * Plan ref: M4 Task 8.
 *
 * Cover:
 *  - Schema valid entry.
 *  - Schema reject: bad date format, deadline < added, deadline > 21 days.
 *  - Loader: file missing → empty; null YAML → empty; invalid → throw.
 *  - isPastDeadline: deadline=today → not past; tomorrow → not past;
 *    yesterday → past.
 *  - addDays: UTC-safe across month boundary + leap-year edge.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  QuarantineEntrySchema,
  QuarantineFileSchema,
  QUARANTINE_MAX_DEADLINE_DAYS,
} from '../../src/utils/quarantine/schema';
import {
  addDays,
  findEntry,
  isPastDeadline,
  loadQuarantine,
} from '../../src/utils/quarantine/loader';

describe('quarantine schema', () => {
  const validEntry = {
    test_id: 'Suite > Sub > Test',
    reason: 'Tracked in GH#123',
    added: '2026-04-28',
    deadline: '2026-05-12',
    owner: 'phucdn7@fpt.com',
  };

  it('accept entry hợp lệ', () => {
    const r = QuarantineEntrySchema.safeParse(validEntry);
    expect(r.success).to.be.true;
  });

  it('reject test_id rỗng', () => {
    const r = QuarantineEntrySchema.safeParse({ ...validEntry, test_id: '' });
    expect(r.success).to.be.false;
  });

  it('reject reason quá ngắn (<10 ký tự)', () => {
    const r = QuarantineEntrySchema.safeParse({ ...validEntry, reason: 'TODO' });
    expect(r.success).to.be.false;
  });

  it('reject deadline sai format (không YYYY-MM-DD)', () => {
    const r = QuarantineEntrySchema.safeParse({ ...validEntry, deadline: '04/28/2026' });
    expect(r.success).to.be.false;
  });

  it('reject deadline < added', () => {
    const r = QuarantineEntrySchema.safeParse({
      ...validEntry,
      added: '2026-05-12',
      deadline: '2026-04-28',
    });
    expect(r.success).to.be.false;
  });

  it('accept deadline = added + 21 ngày (max grace)', () => {
    const r = QuarantineEntrySchema.safeParse({
      ...validEntry,
      added: '2026-04-28',
      deadline: '2026-05-19', // +21
    });
    expect(r.success).to.be.true;
  });

  it('reject deadline > added + 21 ngày', () => {
    const r = QuarantineEntrySchema.safeParse({
      ...validEntry,
      added: '2026-04-28',
      deadline: '2026-05-20', // +22
    });
    expect(r.success).to.be.false;
  });

  it('QUARANTINE_MAX_DEADLINE_DAYS = 21', () => {
    expect(QUARANTINE_MAX_DEADLINE_DAYS).to.equal(21);
  });

  it('FileSchema parse file rỗng entries', () => {
    const r = QuarantineFileSchema.safeParse({ entries: [] });
    expect(r.success).to.be.true;
  });
});

describe('quarantine loader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quarantine-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadQuarantine: file missing → empty entries', () => {
    const file = loadQuarantine(path.join(tmpDir, 'missing.yaml'));
    expect(file.entries).to.deep.equal([]);
  });

  it('loadQuarantine: file empty (null YAML) → empty entries', () => {
    const filePath = path.join(tmpDir, 'empty.yaml');
    fs.writeFileSync(filePath, '# only comments\n');
    const file = loadQuarantine(filePath);
    expect(file.entries).to.deep.equal([]);
  });

  it('loadQuarantine: schema invalid → throw với issue path', () => {
    const filePath = path.join(tmpDir, 'invalid.yaml');
    fs.writeFileSync(
      filePath,
      `entries:
  - test_id: 'X'
    reason: 'short'
    added: '2026-04-28'
    deadline: 'not-a-date'
    owner: 'x'
`,
    );
    expect(() => loadQuarantine(filePath)).to.throw(/Quarantine file invalid/);
  });

  it('loadQuarantine: file valid → parse entries', () => {
    const filePath = path.join(tmpDir, 'valid.yaml');
    fs.writeFileSync(
      filePath,
      `entries:
  - test_id: 'Suite > Test A'
    reason: 'Tracked in GH#42 — flaky on Pixel 6'
    added: '2026-04-28'
    deadline: '2026-05-12'
    owner: 'phucdn7@fpt.com'
`,
    );
    const file = loadQuarantine(filePath);
    expect(file.entries).to.have.lengthOf(1);
    expect(file.entries[0].test_id).to.equal('Suite > Test A');
  });

  it('findEntry: match test_id', () => {
    const file = {
      entries: [
        {
          test_id: 'Suite > Test A',
          reason: 'tracked',
          added: '2026-04-28',
          deadline: '2026-05-12',
          owner: 'x',
        },
      ],
    };
    expect(findEntry('Suite > Test A', file)).to.exist;
    expect(findEntry('Suite > Test B', file)).to.be.undefined;
  });

  it('isPastDeadline: deadline=today → not past (strict greater-than)', () => {
    const now = new Date('2026-04-28T12:00:00Z');
    expect(isPastDeadline({ deadline: '2026-04-28' }, now)).to.be.false;
  });

  it('isPastDeadline: deadline=tomorrow → not past', () => {
    const now = new Date('2026-04-28T12:00:00Z');
    expect(isPastDeadline({ deadline: '2026-04-29' }, now)).to.be.false;
  });

  it('isPastDeadline: deadline=yesterday → past', () => {
    const now = new Date('2026-04-28T12:00:00Z');
    expect(isPastDeadline({ deadline: '2026-04-27' }, now)).to.be.true;
  });

  it('addDays: cùng tháng', () => {
    expect(addDays('2026-04-28', 14)).to.equal('2026-05-12');
  });

  it('addDays: cross month boundary', () => {
    expect(addDays('2026-04-28', 21)).to.equal('2026-05-19');
  });

  it('addDays: leap-year Feb 28 + 1 = Feb 29 (2024)', () => {
    expect(addDays('2024-02-28', 1)).to.equal('2024-02-29');
  });

  it('addDays: non-leap Feb 28 + 1 = Mar 1 (2026)', () => {
    expect(addDays('2026-02-28', 1)).to.equal('2026-03-01');
  });
});
