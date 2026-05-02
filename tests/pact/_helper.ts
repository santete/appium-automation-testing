/**
 * Pact consumer test helper — shared mock provider lifecycle.
 *
 * Spec ref: §10 (Pact tech stack), §3 step 3. Plan ref: M6 Task 3, Decision 2
 * (mobile own consumer + provider stub; provider verification deferred).
 *
 * Pattern (Pact v12+):
 *   - PactV3 builder pattern: `.uponReceiving(...)`, `.willRespondWith(...)`,
 *     `.executeTest(async (mockServer) => { ... })`.
 *   - Mỗi spec spawn mock server riêng (port 0 = random) → song song safe.
 *   - Pact files write tới `pacts/` (gitignored — published qua broker M7).
 */
import * as path from 'node:path';
import { PactV3 } from '@pact-foundation/pact';

export const PACTS_DIR = path.resolve(__dirname, '../../pacts');
export const PACT_LOG_DIR = path.resolve(__dirname, '../../reports/pact-logs');

export function createPact(consumer: string, provider: string): PactV3 {
  return new PactV3({
    consumer,
    provider,
    dir: PACTS_DIR,
    logLevel: 'warn',
  });
}
