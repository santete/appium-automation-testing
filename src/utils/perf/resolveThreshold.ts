/**
 * Resolve performance threshold for a contract — env-aware override.
 *
 * D7 (M7 closure): perf SLA in spec §7.5 calibrated for real device
 * (Pixel 6 USB-tethered). Emulator P95 baseline ~4-5x slower (see
 * docs/rca/2026-05-01-TC_PERF_LOGIN_001.md). Each `AC_PERF_*.yaml`
 * declares `threshold_env_var: <NAME>` so spec implementations resolve
 * runtime threshold via this helper instead of hardcoding `max_ms`.
 *
 * Resolution rules (in order):
 *   1. If `process.env[<threshold_env_var>]` is set → parse + use.
 *   2. Else use contract `max_ms` literal.
 *   3. If emulator detected AND env override NOT set → log a warning
 *      via `logger.warn` (so the run is not silently calibrated wrong).
 *
 * Emulator detection heuristic: `ANDROID_DEVICE_NAME` matches typical
 * emulator name patterns (`emulator-XXXX`, `Pixel_*_API_*`, `AVD_*`,
 * `*_simulator`, etc.). Override via `PERF_FORCE_DEVICE_TYPE=real|emulator`
 * if the heuristic mis-classifies an exotic setup.
 */
import { loadContract } from '../assertion/loader';
import { logger } from '../logger';

interface ResolveOpts {
  /** Override `process.env` (for unit tests). */
  env?: NodeJS.ProcessEnv;
  /** Override logger (for unit tests). */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface ResolvedThreshold {
  thresholdMs: number;
  source: 'env_override' | 'contract_default';
  envVar?: string;
  envValue?: string;
}

/**
 * Resolve threshold for the **first** `time_between` perf check on a contract.
 *
 * Most perf contracts have exactly one perf check; if a contract grows to
 * multiple, callers should switch to `resolvePerfThresholdByCheckId()` and
 * pass the explicit `id`.
 */
export function resolvePerfThreshold(
  contractId: string,
  opts: ResolveOpts = {},
): ResolvedThreshold {
  const env = opts.env ?? process.env;
  const log = opts.log ?? ((m, meta) => logger.warn(m, meta));

  const contract = loadContract(contractId);
  const perfCheck = contract.performance.find((p) => p.type === 'time_between');
  if (!perfCheck) {
    throw new Error(`resolvePerfThreshold: ${contractId} has no time_between perf check`);
  }

  return resolveFromCheck(perfCheck, env, log);
}

export function resolvePerfThresholdByCheckId(
  contractId: string,
  checkId: string,
  opts: ResolveOpts = {},
): ResolvedThreshold {
  const env = opts.env ?? process.env;
  const log = opts.log ?? ((m, meta) => logger.warn(m, meta));

  const contract = loadContract(contractId);
  const perfCheck = contract.performance.find((p) => p.id === checkId);
  if (!perfCheck) {
    throw new Error(
      `resolvePerfThresholdByCheckId: ${contractId} has no perf check id="${checkId}"`,
    );
  }
  return resolveFromCheck(perfCheck, env, log);
}

function resolveFromCheck(
  check: { max_ms: number; threshold_env_var?: string; id: string },
  env: NodeJS.ProcessEnv,
  log: (msg: string, meta?: Record<string, unknown>) => void,
): ResolvedThreshold {
  const envVar = check.threshold_env_var;
  if (envVar) {
    const raw = env[envVar];
    if (raw !== undefined && raw !== '') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${envVar}="${raw}" is not a positive integer ms`);
      }
      return {
        thresholdMs: Math.round(parsed),
        source: 'env_override',
        envVar,
        envValue: raw,
      };
    }
  }

  // No override — emit calibration warning if emulator detected.
  if (envVar && isEmulator(env)) {
    log(
      `Perf check "${check.id}" using contract default ${check.max_ms}ms ` +
        `but ANDROID_DEVICE_NAME looks like an emulator. ` +
        `Real-device baseline is ~4-5x faster than emulator. ` +
        `Set ${envVar} to override (e.g. ${envVar}=${check.max_ms * 4}).`,
      { contractCheckId: check.id, defaultMs: check.max_ms, envVar },
    );
  }

  return {
    thresholdMs: check.max_ms,
    source: 'contract_default',
    envVar,
  };
}

const EMULATOR_PATTERNS = [
  /^emulator-\d+$/i,
  /^Pixel_\d+_API_\d+$/i, // AVD default name format
  /^AVD_/i,
  /_simulator$/i,
  /^iPhone_\d+_Simulator$/i,
];

export function isEmulator(env: NodeJS.ProcessEnv): boolean {
  const force = env.PERF_FORCE_DEVICE_TYPE?.toLowerCase();
  if (force === 'real') return false;
  if (force === 'emulator') return true;

  const name = env.ANDROID_DEVICE_NAME ?? '';
  return EMULATOR_PATTERNS.some((p) => p.test(name));
}
