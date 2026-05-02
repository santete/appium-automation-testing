/**
 * M5 Task 12 — Acceptance harness cho 20-failure classifier corpus.
 *
 * Acceptance §2 sub-point 1 (`docs/plans/M5-observability.md`):
 *   "20 failure mẫu, classifier tự gán {category, layer, reproducible,
 *    rootCause, routeTo} với confidence ≥ 0.9 cho ≥ 16/20 case (80%).
 *    Lưu confusion matrix."
 *
 * Cách verify:
 *   1. Load corpus 20 case từ `tests/fixtures/m5-classifier-corpus/corpus.json`.
 *   2. Run rule-based classifier (KHÔNG escalate LLM — acceptance đo rule-only
 *      baseline, LLM augment là cherry-on-top trong production).
 *   3. Build confusion matrix (expected category × actual category).
 *   4. Assert:
 *      - Category match: 20/20 (rule expectation đúng — corpus design check).
 *      - High-confidence (≥ 0.9): ≥ 16/20.
 *
 * Output confusion matrix log ra console — dev đọc lại để hiểu rule coverage.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classify } from '../../src/utils/classifier/engine';
import type { ClassifierInput, FailureCategory } from '../../src/utils/classifier/types';

interface CorpusCase {
  id: string;
  label: string;
  input: ClassifierInput;
  expected: { category: FailureCategory; matchedRule: string; minConfidence: number };
}

interface Corpus {
  cases: CorpusCase[];
}

const CORPUS_PATH = path.resolve(
  __dirname,
  '../../tests/fixtures/m5-classifier-corpus/corpus.json',
);

const HIGH_CONFIDENCE = 0.9;
const ACCURACY_TARGET = 16; // ≥ 16/20 hit ≥ 0.9

function loadCorpus(): Corpus {
  const raw = fs.readFileSync(CORPUS_PATH, 'utf-8');
  return JSON.parse(raw) as Corpus;
}

function renderConfusionMatrix(
  rows: Array<{ expected: FailureCategory; actual: FailureCategory }>,
): string {
  const cats: FailureCategory[] = [
    'BUG',
    'SCRIPT_ISSUE',
    'FLAKY',
    'ENV_ISSUE',
    'DATA_ISSUE',
    'UNKNOWN',
  ];
  const matrix: Record<string, Record<string, number>> = {};
  for (const c of cats) {
    matrix[c] = {};
    for (const a of cats) matrix[c][a] = 0;
  }
  for (const r of rows) matrix[r.expected][r.actual]++;
  const header = `expected\\actual | ${cats.join(' | ')}`;
  const lines = [header, '-'.repeat(header.length)];
  for (const c of cats) {
    lines.push(`${c.padEnd(15)} | ${cats.map((a) => String(matrix[c][a])).join('  | ')}`);
  }
  return lines.join('\n');
}

describe('M5 acceptance — classifier 20-failure corpus', function () {
  this.timeout(5000);

  const corpus = loadCorpus();

  it('corpus phải đúng 20 case (acceptance design constraint)', () => {
    expect(corpus.cases).to.have.lengthOf(20);
  });

  it('mỗi case match expected category + matchedRule', () => {
    const rows: Array<{ expected: FailureCategory; actual: FailureCategory }> = [];
    const mismatches: string[] = [];
    for (const c of corpus.cases) {
      const out = classify(c.input);
      rows.push({ expected: c.expected.category, actual: out.category });
      if (out.category !== c.expected.category) {
        mismatches.push(
          `${c.id} expected ${c.expected.category} got ${out.category} (rule=${out.matchedRule})`,
        );
      } else if (out.matchedRule !== c.expected.matchedRule) {
        mismatches.push(`${c.id} expected rule ${c.expected.matchedRule} got ${out.matchedRule}`);
      }
    }

    console.log('\n--- Confusion matrix (M5 acceptance §2 #1) ---');
    console.log(renderConfusionMatrix(rows));
    console.log('---\n');

    expect(mismatches, mismatches.join('\n')).to.have.lengthOf(0);
  });

  it(`≥ ${ACCURACY_TARGET}/20 case có confidence ≥ ${HIGH_CONFIDENCE} (rule-only baseline)`, () => {
    let highCount = 0;
    const detail: string[] = [];
    for (const c of corpus.cases) {
      const out = classify(c.input);
      const high = out.confidence >= HIGH_CONFIDENCE;
      if (high) highCount++;
      detail.push(`${c.id} conf=${out.confidence.toFixed(2)} ${high ? '✓' : ' '} (${c.label})`);
    }
    console.log('\n--- Confidence distribution ---');
    for (const d of detail) console.log(d);
    console.log(`Total ≥ ${HIGH_CONFIDENCE}: ${highCount}/20`);
    console.log('---\n');

    expect(highCount).to.be.gte(ACCURACY_TARGET);
  });

  it('mỗi case classifier output có {category, layer, reproducible, rootCause, routeTo}', () => {
    for (const c of corpus.cases) {
      const out = classify(c.input);
      expect(out, c.id).to.have.property('category');
      expect(out, c.id).to.have.property('layer');
      expect(out, c.id).to.have.property('reproducible');
      expect(out, c.id).to.have.property('rootCause');
      expect(out, c.id).to.have.property('routeTo');
      expect(out.rootCause, c.id).to.have.property('description');
      expect(out.rootCause, c.id).to.have.property('evidence');
    }
  });

  it('confidence của mỗi case ≥ minConfidence khai báo trong corpus', () => {
    const failed: string[] = [];
    for (const c of corpus.cases) {
      const out = classify(c.input);
      if (out.confidence < c.expected.minConfidence) {
        failed.push(
          `${c.id} expected ≥ ${c.expected.minConfidence} got ${out.confidence.toFixed(2)}`,
        );
      }
    }
    expect(failed, failed.join('\n')).to.have.lengthOf(0);
  });
});
