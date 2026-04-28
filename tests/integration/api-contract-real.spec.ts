/**
 * Integration test — AC_API_DEMO_001 against real public API (httpbin.org).
 *
 * Plan ref: M3 Task 17, Acceptance §2.5 (D3 path B).
 *
 * Gate qua `ALLOW_NETWORK_INTEGRATION=1` — CI offline tolerance. `tests/api/`
 * suite (npm run test:api) chạy không gate, được invoke explicitly. Integration
 * suite chạy mặc định nên gate để skip ở env không có internet.
 *
 * Coverage:
 *   - Positive: contract chạy real httpbin → verdict PASS, 3/3 checks.
 *   - Negative: schema registry chứa schema misaligned (author=number) → verdict
 *     FAIL, layer API, routeTo 1, assignTo dev_team. Verify failure metadata
 *     route đúng theo §6.2.
 */
import { expect } from 'chai';
import { z } from 'zod';
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { ApiChecker } from '../../src/utils/assertion/checkers/ApiChecker';
import { createApiClient } from '../../src/utils/apiClient';
import { createAxiosApiCheckerDeps } from '../../src/utils/assertion/checkers/axiosApiCheckerDeps';
import { loadEnv } from '../../src/config/index';
import { runApiContract } from '../api/_runner';

describe('Integration: AC_API_DEMO_001 against real httpbin.org', function () {
  this.timeout(20_000);

  before(function () {
    const env = loadEnv();
    if (!env.ALLOW_NETWORK_INTEGRATION) {
      // eslint-disable-next-line no-console
      console.log('  ⊘ skipped (set ALLOW_NETWORK_INTEGRATION=1 to enable)');
      this.skip();
    }
  });

  it('positive: real httpbin response → verdict PASS', async () => {
    const verdict = await runApiContract('AC_API_DEMO_001');
    expect(verdict.status).to.equal('PASS');
    expect(verdict.results).to.have.lengthOf(3);
    expect(verdict.results.every((r) => r.passed)).to.equal(true);
  });

  it('negative: misaligned schema → FAIL, layer=API, routeTo=1', async () => {
    // Schema demand author là number → real httpbin trả string "Yours Truly"
    // → schema check fail. Status check (critical) vẫn pass nên runner không
    // stop early; schema check (high) fail → verdict FAIL.
    const wrongSchema = z.object({
      slideshow: z.object({ author: z.number() }),
    });
    const apiChecker = new ApiChecker(
      createAxiosApiCheckerDeps(createApiClient(), { HttpbinSlideshow: wrongSchema }),
    );
    const runner = new AssertionRunner({ api: apiChecker });

    const verdict = await runner.runContractById('AC_API_DEMO_001');

    expect(verdict.status).to.equal('FAIL');
    expect(verdict.failureMetadata?.layer).to.equal('API');
    expect(verdict.failureMetadata?.routeTo).to.equal(1);
    expect(verdict.failureMetadata?.assignTo).to.equal('dev_team');

    const schemaFail = verdict.results.find((r) => r.id === 'api.httpbin_schema');
    expect(schemaFail?.passed).to.equal(false);
    expect(schemaFail?.message).to.contain('HttpbinSlideshow');
  });
});
