/**
 * AssertionRunner — orchestrate multi-layer assertion execution per spec §5.3 + §6.
 *
 * Plan ref: M2 Task 8, Decision §4.D3 (severity → action), §4.D6 (custom soft
 * assertion accumulator).
 *
 * Flow:
 *   load → for each layer in [UI, API, STATE, NEGATIVE, PERF]:
 *     for each check in layer:
 *       execute via correct checker
 *       wrap CheckOutcome → AssertionResult (id/layer/type/severity/durationMs)
 *       if !passed && severity==='critical': stop early, set stoppedEarly=true
 *   compute verdict:
 *     any critical fail → FAIL
 *     any high fail → FAIL
 *     any medium fail → PASS_WITH_WARNINGS
 *     low fail only / no fail → PASS
 *   if FAIL: build FailureMetadata (M2 emit only — M5 routing đọc).
 */
import type {
  AssertionContract,
  AnyCheck,
  ApiCheck,
  NegativeCheck,
  PerfCheck,
  StateCheck,
  UiCheck,
} from '../../contracts/_schema';
import type { ApiChecker } from './checkers/ApiChecker';
import type { NegativeChecker } from './checkers/NegativeChecker';
import type { PerfChecker } from './checkers/PerfChecker';
import type { StateChecker } from './checkers/StateChecker';
import type { UiChecker } from './checkers/UiChecker';
import { loadContract } from './loader';
import type {
  AssertionResult,
  CheckOutcome,
  FailureMetadata,
  Layer,
  Severity,
  Verdict,
  VerdictResult,
} from './types';

export interface CheckerSet {
  ui?: UiChecker;
  api?: ApiChecker;
  state?: StateChecker;
  negative?: NegativeChecker;
  perf?: PerfChecker;
}

export interface RunOptions {
  /** Override now() — useful cho test reproducibility. */
  now?: () => number;
  /** Override ISO timestamp generator — test reproducibility. */
  isoNow?: () => string;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export class AssertionRunner {
  constructor(
    private readonly checkers: CheckerSet,
    private readonly opts: RunOptions = {},
  ) {}

  /** Load contract by ID rồi run. Throws `ContractValidationError` nếu YAML invalid. */
  async runContractById(contractId: string): Promise<VerdictResult> {
    const contract = loadContract(contractId);
    return this.runContract(contract);
  }

  async runContract(contract: AssertionContract): Promise<VerdictResult> {
    const now = this.opts.now ?? (() => Date.now());
    const isoNow = this.opts.isoNow ?? (() => new Date().toISOString());

    const startedAt = isoNow();
    const results: AssertionResult[] = [];
    let stoppedEarly = false;

    const layered: Array<{ layer: Layer; checks: AnyCheck[] }> = [
      { layer: 'UI', checks: contract.positive.ui_layer ?? [] },
      { layer: 'API', checks: contract.positive.api_layer ?? [] },
      { layer: 'STATE', checks: contract.positive.state_layer ?? [] },
      { layer: 'NEGATIVE', checks: contract.negative ?? [] },
      { layer: 'PERF', checks: contract.performance ?? [] },
    ];

    outer: for (const { layer, checks } of layered) {
      for (const check of checks) {
        const t0 = now();
        const outcome = await this.dispatch(layer, check);
        const t1 = now();
        const result = wrap(layer, check, outcome, t1 - t0);
        results.push(result);

        if (!result.passed && result.severity === 'critical') {
          stoppedEarly = true;
          break outer;
        }
      }
    }

    const status = computeVerdict(results);
    const finishedAt = isoNow();

    const verdict: VerdictResult = {
      contractId: contract.contract_id,
      testScenario: contract.test_scenario,
      status,
      results,
      stoppedEarly,
      startedAt,
      finishedAt,
    };

    if (status === 'FAIL') {
      verdict.failureMetadata = buildFailureMetadata(contract.test_scenario, results);
    }

    return verdict;
  }

  private async dispatch(layer: Layer, check: AnyCheck): Promise<CheckOutcome> {
    switch (layer) {
      case 'UI':
        return this.requireChecker('ui', this.checkers.ui).run(check as UiCheck);
      case 'API':
        return this.requireChecker('api', this.checkers.api).run(check as ApiCheck);
      case 'STATE':
        return this.requireChecker('state', this.checkers.state).run(check as StateCheck);
      case 'NEGATIVE':
        return this.requireChecker('negative', this.checkers.negative).run(check as NegativeCheck);
      case 'PERF':
        return this.requireChecker('perf', this.checkers.perf).run(check as PerfCheck);
    }
  }

  private requireChecker<T>(name: string, checker: T | undefined): T {
    if (!checker) {
      throw new Error(
        `AssertionRunner: contract uses ${name} layer but no '${name}' checker was injected`,
      );
    }
    return checker;
  }
}

function wrap(
  layer: Layer,
  check: AnyCheck,
  outcome: CheckOutcome,
  durationMs: number,
): AssertionResult {
  if (!outcome.passed && !outcome.message) {
    throw new Error(
      `Checker invariant violated: passed=false but no message for ${layer}/${check.type}/${check.id}`,
    );
  }
  const result: AssertionResult = {
    id: check.id,
    layer,
    type: check.type,
    severity: check.severity,
    passed: outcome.passed,
    evidence: outcome.evidence,
    durationMs,
  };
  if (outcome.message !== undefined) result.message = outcome.message;
  if (layer === 'NEGATIVE' && 'securityImpact' in check && check.securityImpact) {
    result.securityImpact = true;
  }
  return result;
}

function computeVerdict(results: AssertionResult[]): Verdict {
  let worstFail = 0;
  for (const r of results) {
    if (!r.passed) {
      worstFail = Math.max(worstFail, SEVERITY_RANK[r.severity]);
    }
  }
  if (worstFail >= SEVERITY_RANK.high) return 'FAIL';
  if (worstFail === SEVERITY_RANK.medium) return 'PASS_WITH_WARNINGS';
  return 'PASS';
}

/**
 * Build FailureMetadata khi verdict=FAIL (spec §6.3).
 * M2: heuristic classification + routing dựa trên FIRST critical fail
 * (hoặc FIRST highest-severity fail nếu không có critical). M5 sẽ
 * augment qua history.
 */
function buildFailureMetadata(testScenario: string, results: AssertionResult[]): FailureMetadata {
  const fails = results.filter((r) => !r.passed);
  const primary = pickPrimaryFail(fails);

  const layer = primary.layer;
  const securityImpact = fails.some((f) => f.securityImpact);

  const { category, routeTo, assignTo, priority } = classifyFailure(
    layer,
    primary.severity,
    securityImpact,
  );

  return {
    testId: testScenario,
    category,
    layer,
    reproducible: true,
    reproductionRate: 1.0,
    rootCause: {
      description: primary.message ?? `${layer}/${primary.type}/${primary.id} failed`,
      evidence: primary.evidence,
    },
    routeTo,
    assignTo,
    priority,
    ...(securityImpact ? { securityImpact: true } : {}),
  };
}

function pickPrimaryFail(fails: AssertionResult[]): AssertionResult {
  let best = fails[0];
  for (const f of fails) {
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[best.severity]) best = f;
  }
  return best;
}

/**
 * Heuristic routing per spec §6.2 table:
 *   API fail        → step 1 (req) hoặc dev — assignTo dev_team, route 1
 *   STATE fail      → step 4 (impl) — dev_team, route 4
 *   UI fail         → step 4 (locator/impl) — dev_team, route 4
 *   NEGATIVE fail   → step 2 (contract review) — qa_team, route 2
 *   PERF fail       → step 7 (RCA) — qa_team, route 7
 * securityImpact bumps priority to P0 và assignTo dev_team.
 */
function classifyFailure(
  layer: Layer,
  severity: Severity,
  securityImpact: boolean,
): {
  category: FailureMetadata['category'];
  routeTo: FailureMetadata['routeTo'];
  assignTo: FailureMetadata['assignTo'];
  priority: FailureMetadata['priority'];
} {
  let routeTo: FailureMetadata['routeTo'];
  let assignTo: FailureMetadata['assignTo'];
  switch (layer) {
    case 'API':
      routeTo = 1;
      assignTo = 'dev_team';
      break;
    case 'STATE':
    case 'UI':
      routeTo = 4;
      assignTo = 'dev_team';
      break;
    case 'NEGATIVE':
      routeTo = 2;
      assignTo = 'qa_team';
      break;
    case 'PERF':
      routeTo = 7;
      assignTo = 'qa_team';
      break;
  }

  const priority: FailureMetadata['priority'] = securityImpact
    ? 'P0'
    : severity === 'critical'
      ? 'P1'
      : severity === 'high'
        ? 'P2'
        : 'P3';

  return { category: 'BUG', routeTo, assignTo, priority };
}
