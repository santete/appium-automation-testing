/**
 * Allure integration — convert VerdictResult thành Allure steps + attachments.
 *
 * Spec ref: §10 (Allure reporting), §6 (per-layer verdict visible).
 * Plan ref: M2 Task 9.
 *
 * Tách khỏi `AssertionRunner` (runner trả pure data) để:
 *   - Unit test runner KHÔNG cần Allure runtime.
 *   - Test code có thể call `attachVerdict(result)` ở bất kỳ đâu trong test.
 *
 * Sử dụng: trong `afterEach`, sau khi runner trả VerdictResult, gọi
 *   `attachVerdictToAllure(verdict)`. Reporter import qua `allureDeps`
 *   (DI để test).
 */
import * as fs from 'node:fs';
import type { AssertionResult, VerdictResult } from './types';

export interface AllureLike {
  addStep(title: string, body?: object, status?: 'passed' | 'failed' | 'broken'): void;
  addAttachment(name: string, content: string | Buffer, type: string): void;
  addLabel(name: string, value: string): void;
  addArgument(name: string, value: string): void;
}

const STATUS_LABEL: Record<VerdictResult['status'], string> = {
  PASS: '✅ PASS',
  PASS_WITH_WARNINGS: '⚠️ PASS_WITH_WARNINGS',
  FAIL: '❌ FAIL',
};

export function attachVerdictToAllure(verdict: VerdictResult, allure: AllureLike): void {
  allure.addLabel('contract_id', verdict.contractId);
  allure.addLabel('test_scenario', verdict.testScenario);
  allure.addLabel('verdict', verdict.status);
  if (verdict.stoppedEarly) allure.addLabel('stopped_early', 'true');

  const counts = countByLayer(verdict.results);
  for (const [layer, c] of Object.entries(counts)) {
    if (c.total > 0) {
      allure.addArgument(`${layer}_layer`, `${c.passed}/${c.total} passed`);
    }
  }

  for (const r of verdict.results) {
    const title = formatStepTitle(r);
    allure.addStep(title, undefined, r.passed ? 'passed' : 'failed');
    for (const evidence of r.evidence) {
      attachFileIfExists(evidence, allure);
    }
  }

  allure.addAttachment('verdict.json', JSON.stringify(verdict, null, 2), 'application/json');

  if (verdict.failureMetadata) {
    allure.addAttachment(
      'failure-metadata.json',
      JSON.stringify(verdict.failureMetadata, null, 2),
      'application/json',
    );
    allure.addLabel('route_to_step', String(verdict.failureMetadata.routeTo));
    allure.addLabel('assign_to', verdict.failureMetadata.assignTo);
    allure.addLabel('priority', verdict.failureMetadata.priority);
    if (verdict.failureMetadata.securityImpact) {
      allure.addLabel('security_impact', 'true');
    }
  }

  // Final summary step để dễ skim trên Allure UI.
  allure.addStep(
    `Verdict: ${STATUS_LABEL[verdict.status]} (${verdict.results.length} checks, ${verdict.finishedAt})`,
    undefined,
    verdict.status === 'FAIL' ? 'failed' : 'passed',
  );
}

function formatStepTitle(r: AssertionResult): string {
  const status = r.passed ? '✓' : '✗';
  const sev = r.severity.toUpperCase();
  const dur = `${r.durationMs}ms`;
  const detail = r.passed ? '' : ` — ${r.message ?? '(no message)'}`;
  return `${status} [${r.layer}/${sev}] ${r.id} (${r.type}, ${dur})${detail}`;
}

function countByLayer(
  results: AssertionResult[],
): Record<string, { passed: number; total: number }> {
  const acc: Record<string, { passed: number; total: number }> = {};
  for (const r of results) {
    const slot = (acc[r.layer] ??= { passed: 0, total: 0 });
    slot.total++;
    if (r.passed) slot.passed++;
  }
  return acc;
}

function attachFileIfExists(filePath: string, allure: AllureLike): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    allure.addAttachment(name, buf, guessMime(filePath));
  } catch {
    // Evidence attachment best-effort; không fail test vì attach lỗi.
  }
}

function guessMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'har':
      return 'application/json';
    case 'txt':
    case 'log':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Runtime adapter wrap `@wdio/allure-reporter`. Tách khỏi logic chính để unit
 * test inject mock. Lazy import để module load không crash khi reporter chưa
 * available (vd. unit test environment).
 */
export async function getDefaultAllure(): Promise<AllureLike> {
  const mod = await import('@wdio/allure-reporter');
  const reporter = (mod.default ?? mod) as unknown as AllureLike;
  return reporter;
}
