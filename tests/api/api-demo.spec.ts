/**
 * TC_API_DEMO_001 — D3 path B: prove framework's API layer hits real public
 * HTTP endpoint (httpbin.org/json) end-to-end, KHÔNG qua MSW.
 *
 * Plan ref: M3 Task 15-16, D3 repay path B.
 *
 * Run qua `npm run test:api`. Suite tách riêng vì hit real network — không nên
 * chạy trong unit/integration suite (CI offline tolerance).
 */
import { expect } from 'chai';
import { runApiContract } from './_runner';

describe('TC_API_DEMO_001 — AC_API_DEMO_001 against real httpbin.org', function () {
  this.timeout(15_000);

  it('all 3 api_layer checks pass against live endpoint', async () => {
    const verdict = await runApiContract('AC_API_DEMO_001');

    if (verdict.status !== 'PASS') {
      const fails = verdict.results
        .filter((r) => !r.passed)
        .map((r) => `[${r.layer}/${r.severity}] ${r.id}: ${r.message ?? ''}`)
        .join('\n  ');
      throw new Error(`AC_API_DEMO_001 expected PASS, got ${verdict.status}:\n  ${fails}`);
    }

    expect(verdict.status).to.equal('PASS');
    expect(verdict.results).to.have.lengthOf(3);
    expect(verdict.stoppedEarly).to.equal(false);
    expect(verdict.results.every((r) => r.passed)).to.equal(true);
  });
});
