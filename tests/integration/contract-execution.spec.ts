/**
 * Integration test — load YAML contract → execute via AssertionRunner →
 * verify verdict. MSW boots Node server intercepting axios calls.
 *
 * Plan ref: M2 Task 11, Decision §4.D9 (MSW).
 *
 * Tests:
 *   1. AC_API_DEMO.yaml all-pass → PASS
 *   2. MSW returns wrong status → FAIL with stoppedEarly (critical)
 *   3. MSW returns wrong schema → FAIL routing to API layer
 */
import { expect } from 'chai';
import { setupServer } from 'msw/node';
type Server = ReturnType<typeof setupServer>;
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { AssertionRunner } from '../../src/utils/assertion/AssertionRunner';
import { ApiChecker } from '../../src/utils/assertion/checkers/ApiChecker';
import { createApiClient } from '../../src/utils/apiClient';
import { createAxiosApiCheckerDeps } from '../../src/utils/assertion/checkers/axiosApiCheckerDeps';
import { loadContract } from '../../src/utils/assertion/loader';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  role: z.string(),
});

const URL = 'http://localhost:4571/users/me';

describe('Integration: AC_API_DEMO contract end-to-end', () => {
  let server: Server;

  beforeEach(() => {
    server = setupServer();
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.close();
  });

  function buildRunner(): AssertionRunner {
    const apiChecker = new ApiChecker(
      createAxiosApiCheckerDeps(createApiClient(), { User: UserSchema }),
    );
    return new AssertionRunner({ api: apiChecker });
  }

  it('all-pass MSW response → verdict PASS', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ id: 1, name: 'Alice', role: 'admin' }, { status: 200 }),
      ),
    );

    const verdict = await buildRunner().runContractById('AC_API_DEMO');
    expect(verdict.status).to.equal('PASS');
    expect(verdict.results).to.have.lengthOf(3);
    expect(verdict.results.every((r) => r.passed)).to.equal(true);
  });

  it('MSW returns 500 → critical fail, stoppedEarly, no further checks', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: 'down' }, { status: 500 })));

    const verdict = await buildRunner().runContractById('AC_API_DEMO');
    expect(verdict.status).to.equal('FAIL');
    expect(verdict.stoppedEarly).to.equal(true);
    expect(verdict.results).to.have.lengthOf(1);
    expect(verdict.failureMetadata?.layer).to.equal('API');
    expect(verdict.failureMetadata?.routeTo).to.equal(1);
    expect(verdict.failureMetadata?.assignTo).to.equal('dev_team');
  });

  it('MSW returns wrong schema → schema fail, all checks run', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ id: 'not-a-number', name: 'X', role: 'admin' }, { status: 200 }),
      ),
    );

    const verdict = await buildRunner().runContractById('AC_API_DEMO');
    expect(verdict.status).to.equal('FAIL');
    expect(verdict.stoppedEarly).to.equal(false);
    expect(verdict.results).to.have.lengthOf(3);
    const schemaFail = verdict.results.find((r) => r.id === 'api.users_me_schema');
    expect(schemaFail?.passed).to.equal(false);
    expect(schemaFail?.message).to.contain('User');
  });

  it('MSW returns wrong role → medium body_contains fail → PASS_WITH_WARNINGS', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ id: 1, name: 'Bob', role: 'guest' }, { status: 200 }),
      ),
    );

    const verdict = await buildRunner().runContractById('AC_API_DEMO');
    expect(verdict.status).to.equal('PASS_WITH_WARNINGS');
    const roleFail = verdict.results.find((r) => r.id === 'api.users_me_role');
    expect(roleFail?.passed).to.equal(false);
    expect(roleFail?.message).to.contain('admin');
  });
});

describe('Integration: contract loader from disk', () => {
  it('loadContract finds AC_API_DEMO.yaml', () => {
    const contract = loadContract('AC_API_DEMO');
    expect(contract.contract_id).to.equal('AC_API_DEMO');
    expect(contract.positive.api_layer).to.have.lengthOf(3);
  });

  it('loadContract throws clear error for missing file', () => {
    expect(() => loadContract('AC_DOES_NOT_EXIST_999')).to.throw(/file not found/);
  });
});
