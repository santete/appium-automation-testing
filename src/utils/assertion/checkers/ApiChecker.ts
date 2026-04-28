/**
 * ApiChecker — execute API-layer assertions (HTTP request + response check).
 *
 * Spec ref: §5.4 (API layer), §6.
 * Plan ref: M2 Task 4, Decisions §4.D1 (Zod), §4.D5 (Node-side request),
 * §4.D9 (MSW mocking).
 *
 * Design: dependency injection cho `request` adapter — runtime inject Axios,
 * unit test inject mock. `schemaRegistry` map `schema_ref` string → Zod schema
 * (no eval, registered ở boot time).
 *
 * Mỗi `ApiCheck.type` map 1-1 vào 1 case trong `switch` (intentional friction
 * như UiChecker).
 */
import type { ZodTypeAny } from 'zod';
import type { ApiCheck } from '../../../contracts/_schema';
import type { CheckOutcome } from '../types';

/** HTTP response shape mà ApiChecker cần. Subset của AxiosResponse. */
export interface HttpResponse {
  status: number;
  data: unknown;
  headers?: Record<string, unknown>;
}

export interface HttpRequestArgs {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ApiCheckerDeps {
  /** Send HTTP request. KHÔNG throw trên non-2xx (status được inspect bởi checker). */
  request: (args: HttpRequestArgs) => Promise<HttpResponse>;
  /** Map `schema_ref` → Zod schema. Lookup fail → check fail with clear message. */
  schemaRegistry?: Record<string, ZodTypeAny>;
}

export class ApiChecker {
  constructor(private readonly deps: ApiCheckerDeps) {}

  async run(check: ApiCheck): Promise<CheckOutcome> {
    switch (check.type) {
      case 'http_request':
        return this.httpRequest(check);
    }
  }

  private async httpRequest(
    check: Extract<ApiCheck, { type: 'http_request' }>,
  ): Promise<CheckOutcome> {
    let res: HttpResponse;
    try {
      res = await this.deps.request({
        method: check.method,
        url: check.url,
        headers: check.headers,
        body: check.body,
      });
    } catch (err) {
      return {
        passed: false,
        message: `http_request ${check.method} ${check.url} threw: ${errMsg(err)}`,
        evidence: [],
      };
    }

    const failures: string[] = [];

    if (check.expect.status !== undefined && res.status !== check.expect.status) {
      failures.push(`expected status ${check.expect.status}, got ${res.status}`);
    }

    if (check.expect.schema_ref !== undefined) {
      const schema = this.deps.schemaRegistry?.[check.expect.schema_ref];
      if (!schema) {
        failures.push(`schema_ref "${check.expect.schema_ref}" not found in registry`);
      } else {
        const parsed = schema.safeParse(res.data);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join('; ');
          failures.push(`schema_ref "${check.expect.schema_ref}" mismatch: ${issues}`);
        }
      }
    }

    if (check.expect.body_contains !== undefined) {
      const missing = findMissingPaths(check.expect.body_contains, res.data);
      if (missing.length > 0) {
        failures.push(`body_contains mismatch: ${missing.join('; ')}`);
      }
    }

    if (failures.length > 0) {
      return {
        passed: false,
        message: `${check.method} ${check.url} → ${failures.join(' | ')}`,
        evidence: [],
      };
    }
    return { passed: true, evidence: [] };
  }
}

/**
 * Deep-subset check: every leaf in `expected` phải có path tương ứng trong `actual`
 * và value strict-equal (cho primitive) hoặc deep-equal (cho array của primitive).
 * Trả về list of mismatch descriptions, empty nếu match.
 */
function findMissingPaths(expected: unknown, actual: unknown, path: string[] = []): string[] {
  if (expected === null || typeof expected !== 'object') {
    if (!Object.is(expected, actual)) {
      return [
        `${path.join('.') || '<root>'}: expected ${stringify(expected)}, got ${stringify(actual)}`,
      ];
    }
    return [];
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return [`${path.join('.') || '<root>'}: expected array, got ${stringify(actual)}`];
    }
    const mismatches: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      mismatches.push(...findMissingPaths(expected[i], actual[i], [...path, String(i)]));
    }
    return mismatches;
  }

  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
    return [`${path.join('.') || '<root>'}: expected object, got ${stringify(actual)}`];
  }

  const mismatches: string[] = [];
  for (const [key, val] of Object.entries(expected as Record<string, unknown>)) {
    mismatches.push(
      ...findMissingPaths(val, (actual as Record<string, unknown>)[key], [...path, key]),
    );
  }
  return mismatches;
}

function stringify(v: unknown): string {
  if (v === undefined) return '<undefined>';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
