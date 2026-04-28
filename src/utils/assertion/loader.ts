/**
 * Contract loader — đọc YAML từ `src/contracts/AC_*.yaml`, parse, validate qua Zod.
 *
 * Fail-fast: contract invalid → throw `ContractValidationError` với
 * message format actionable (path + lý do) trước khi runner chạy assertion nào.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { ZodError } from 'zod';
import { AssertionContractSchema, type AssertionContract } from '../../contracts/_schema';

const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts');

export class ContractValidationError extends Error {
  constructor(
    public readonly contractPath: string,
    public readonly issues: string[],
  ) {
    const summary = issues.map((i) => `  - ${i}`).join('\n');
    super(`Contract invalid: ${contractPath}\n${summary}`);
    this.name = 'ContractValidationError';
  }
}

/**
 * Load + validate contract by ID. Resolves file at `<CONTRACTS_DIR>/<id>.yaml`.
 *
 * @throws {ContractValidationError} nếu YAML parse fail HOẶC Zod validate fail.
 */
export function loadContract(contractId: string): AssertionContract {
  const filePath = path.join(CONTRACTS_DIR, `${contractId}.yaml`);

  if (!fs.existsSync(filePath)) {
    throw new ContractValidationError(filePath, ['file not found']);
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ContractValidationError(filePath, [`YAML parse error: ${msg}`]);
  }

  const result = AssertionContractSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContractValidationError(filePath, formatZodIssues(result.error));
  }

  if (result.data.contract_id !== contractId) {
    throw new ContractValidationError(filePath, [
      `contract_id mismatch: file expects "${contractId}" but YAML has "${result.data.contract_id}"`,
    ]);
  }

  return result.data;
}

/**
 * Validate contract object đã parse sẵn (vd. literal trong test).
 * Cùng error format với `loadContract`.
 */
export function validateContract(parsed: unknown, source = '<inline>'): AssertionContract {
  const result = AssertionContractSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContractValidationError(source, formatZodIssues(result.error));
  }
  return result.data;
}

function formatZodIssues(err: ZodError): string[] {
  return err.issues.map((issue) => {
    const loc = issue.path.length > 0 ? issue.path.join('.') : '<root>';
    return `${loc}: ${issue.message}`;
  });
}
