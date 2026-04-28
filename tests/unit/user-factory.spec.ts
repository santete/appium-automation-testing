/**
 * Unit tests cho UserFactory — wraps AccountPool đúng, lease/release symmetry.
 *
 * Plan ref: M3 Task 7.
 */
import { expect } from 'chai';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { UserFactory } from '../../src/factories/UserFactory';
import {
  AccountPool,
  type AccountPoolDeps,
  type PoolConfig,
} from '../../src/utils/accountPool/AccountPool';

function buildConfig(): PoolConfig {
  return {
    password: 'secret_sauce',
    staleLeaseTimeoutMs: 60_000,
    leaseAcquireTimeoutMs: 1_000,
    users: [
      { username: 'standard_user', roles: ['standard', 'smoke'] },
      { username: 'locked_out_user', roles: ['locked_out', 'negative'] },
    ],
  };
}

function buildDeps(): AccountPoolDeps {
  return {
    fileLock: {
      async ensureFile(filePath, defaultContent) {
        try {
          await fs.access(filePath);
        } catch {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, defaultContent, 'utf8');
        }
      },
      async acquire() {
        return async () => {};
      },
    },
    now: () => new Date(),
    ownerId: () => 'pid-test',
  };
}

async function tmpStatePath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'user-factory-test-'));
  return path.join(dir, 'state.json');
}

describe('UserFactory', () => {
  it('setup() lease account, expose username/password/roles', async () => {
    const pool = new AccountPool(buildConfig(), await tmpStatePath(), buildDeps());
    const factory = new UserFactory(pool);

    const user = await factory.setup({ testId: 'TC_TEST' }, { role: 'smoke' });
    expect(user.username).to.equal('standard_user');
    expect(user.password).to.equal('secret_sauce');
    expect(user.roles).to.include('standard');
  });

  it('cleanup() release account back to pool', async () => {
    const pool = new AccountPool(buildConfig(), await tmpStatePath(), buildDeps());
    const factory = new UserFactory(pool);

    const user = await factory.setup({ testId: 'TC_TEST' });
    await user.cleanup();

    const inspected = await pool.inspect();
    expect(inspected.leases[user.username].inUse).to.equal(false);
  });

  it('setup() không có role → lease bất kỳ account available', async () => {
    const pool = new AccountPool(buildConfig(), await tmpStatePath(), buildDeps());
    const factory = new UserFactory(pool);

    const user = await factory.setup({ testId: 'TC_TEST' });
    expect(['standard_user', 'locked_out_user']).to.include(user.username);
  });

  it('setup() với role không match → throw NoAccountAvailableError', async () => {
    const pool = new AccountPool(buildConfig(), await tmpStatePath(), buildDeps());
    const factory = new UserFactory(pool);

    let err: Error | undefined;
    try {
      await factory.setup({ testId: 'TC_TEST' }, { role: 'visual' });
    } catch (e) {
      err = e as Error;
    }
    expect(err?.name).to.equal('NoAccountAvailableError');
  });
});
