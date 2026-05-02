/**
 * Unit tests cho AccountPool — lease/release semantics, role filtering, stale
 * reclaim. File lock được mock (no real filesystem contention).
 *
 * Plan ref: M3 Task 5.
 */
import { expect } from 'chai';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  AccountPool,
  NoAccountAvailableError,
  type AccountPoolDeps,
  type PoolConfig,
} from '../../src/utils/accountPool/AccountPool';

function buildConfig(overrides: Partial<PoolConfig> = {}): PoolConfig {
  return {
    password: 'secret_sauce',
    staleLeaseTimeoutMs: 60_000,
    leaseAcquireTimeoutMs: 1_000,
    users: [
      { username: 'standard_user', roles: ['standard', 'smoke'] },
      { username: 'locked_out_user', roles: ['locked_out', 'negative'] },
      { username: 'problem_user', roles: ['problem', 'regression'] },
    ],
    ...overrides,
  };
}

interface FakeLockState {
  acquireCalls: number;
  releaseCalls: number;
}

function buildDeps(
  now: () => Date,
  ownerId = 'pid-test',
): AccountPoolDeps & { lock: FakeLockState } {
  const lockState: FakeLockState = { acquireCalls: 0, releaseCalls: 0 };
  return {
    lock: lockState,
    fileLock: {
      async ensureFile(filePath: string, defaultContent: string): Promise<void> {
        try {
          await fs.access(filePath);
        } catch {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, defaultContent, 'utf8');
        }
      },
      async acquire(): Promise<() => Promise<void>> {
        lockState.acquireCalls++;
        return async () => {
          lockState.releaseCalls++;
        };
      },
    },
    now,
    ownerId: () => ownerId,
  };
}

async function tmpStatePath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'account-pool-test-'));
  return path.join(dir, 'state.json');
}

describe('AccountPool', () => {
  it('lease() trả account đầu tiên available, set inUse=true', async () => {
    const statePath = await tmpStatePath();
    const deps = buildDeps(() => new Date('2026-04-27T00:00:00Z'));
    const pool = new AccountPool(buildConfig(), statePath, deps);

    const account = await pool.lease();
    expect(account.username).to.equal('standard_user');
    expect(account.password).to.equal('secret_sauce');
    expect(account.roles).to.deep.equal(['standard', 'smoke']);

    const inspected = await pool.inspect();
    expect(inspected.leases.standard_user.inUse).to.equal(true);
    expect(inspected.leases.standard_user.leasedBy).to.equal('pid-test');
    expect(deps.lock.acquireCalls).to.be.greaterThan(0);
    expect(deps.lock.releaseCalls).to.equal(deps.lock.acquireCalls);
  });

  it('lease(role) chỉ trả account match role', async () => {
    const statePath = await tmpStatePath();
    const pool = new AccountPool(
      buildConfig(),
      statePath,
      buildDeps(() => new Date()),
    );

    const account = await pool.lease('locked_out');
    expect(account.username).to.equal('locked_out_user');
  });

  it('lease() throw NoAccountAvailableError khi pool hết', async () => {
    const statePath = await tmpStatePath();
    const pool = new AccountPool(
      buildConfig({ users: [{ username: 'only_user', roles: ['standard'] }] }),
      statePath,
      buildDeps(() => new Date()),
    );

    await pool.lease();
    let err: Error | undefined;
    try {
      await pool.lease();
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.be.instanceOf(NoAccountAvailableError);
    expect(err?.message).to.match(/in-use/i);
  });

  it('lease(role) throw nếu role không có account match', async () => {
    const statePath = await tmpStatePath();
    const pool = new AccountPool(
      buildConfig(),
      statePath,
      buildDeps(() => new Date()),
    );

    let err: Error | undefined;
    try {
      await pool.lease('nonexistent_role');
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.be.instanceOf(NoAccountAvailableError);
    expect(err?.message).to.match(/nonexistent_role/);
  });

  it('release() flip inUse=false, idempotent', async () => {
    const statePath = await tmpStatePath();
    const pool = new AccountPool(
      buildConfig(),
      statePath,
      buildDeps(() => new Date()),
    );

    const account = await pool.lease();
    await pool.release(account);

    const after = await pool.inspect();
    expect(after.leases[account.username].inUse).to.equal(false);
    expect(after.leases[account.username].leasedAt).to.equal(null);

    // Re-release — không throw.
    await pool.release(account);
  });

  it('release() chỉ ảnh hưởng account đó, không các account khác', async () => {
    const statePath = await tmpStatePath();
    const pool = new AccountPool(
      buildConfig(),
      statePath,
      buildDeps(() => new Date()),
    );

    const a = await pool.lease();
    const b = await pool.lease();
    expect(a.username).to.not.equal(b.username);

    await pool.release(a);
    const inspected = await pool.inspect();
    expect(inspected.leases[a.username].inUse).to.equal(false);
    expect(inspected.leases[b.username].inUse).to.equal(true);
  });

  it('stale lease reclaim: account leased > staleLeaseTimeoutMs trước → auto-released khi lease tiếp', async () => {
    const statePath = await tmpStatePath();
    let currentTime = new Date('2026-04-27T00:00:00Z').getTime();
    const deps = buildDeps(() => new Date(currentTime));
    const pool = new AccountPool(
      buildConfig({
        staleLeaseTimeoutMs: 60_000,
        users: [{ username: 'only_user', roles: ['standard'] }],
      }),
      statePath,
      deps,
    );

    await pool.lease(); // leased ở t=0
    // Advance > 60s → stale.
    currentTime += 61_000;

    // Lease tiếp → reclaim stale + leased lại.
    const reLeased = await pool.lease();
    expect(reLeased.username).to.equal('only_user');

    const inspected = await pool.inspect();
    expect(inspected.leases.only_user.inUse).to.equal(true);
    expect(Date.parse(inspected.leases.only_user.leasedAt!)).to.equal(currentTime);
  });

  it('stale reclaim KHÔNG trigger nếu lease còn fresh', async () => {
    const statePath = await tmpStatePath();
    let currentTime = new Date('2026-04-27T00:00:00Z').getTime();
    const deps = buildDeps(() => new Date(currentTime));
    const pool = new AccountPool(
      buildConfig({
        staleLeaseTimeoutMs: 60_000,
        users: [{ username: 'only_user', roles: ['standard'] }],
      }),
      statePath,
      deps,
    );

    await pool.lease();
    currentTime += 30_000; // chưa stale.

    let err: Error | undefined;
    try {
      await pool.lease();
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.be.instanceOf(NoAccountAvailableError);
  });

  it('hydrate missing entries cho user mới thêm vào config sau khi state file đã tạo', async () => {
    const statePath = await tmpStatePath();
    const deps = buildDeps(() => new Date());

    // Tạo state file với chỉ 1 user.
    await fs.writeFile(
      statePath,
      JSON.stringify({
        leases: {
          standard_user: { inUse: false, leasedAt: null, leasedBy: null },
        },
      }),
      'utf8',
    );

    // Pool config có 3 user → hydrate 2 user mới.
    const pool = new AccountPool(buildConfig(), statePath, deps);
    const inspected = await pool.inspect();
    expect(Object.keys(inspected.leases)).to.have.lengthOf(3);
    expect(inspected.leases.locked_out_user.inUse).to.equal(false);
  });

  it('throws nếu config.users rỗng', () => {
    const path = '/tmp/nope.json';
    expect(() => new AccountPool(buildConfig({ users: [] }), path)).to.throw(/ít nhất 1 user/);
  });

  it('lock acquire/release balanced ngay cả khi lease throw', async () => {
    const statePath = await tmpStatePath();
    const deps = buildDeps(() => new Date());
    const pool = new AccountPool(
      buildConfig({
        users: [{ username: 'u', roles: ['x'] }],
        // Short timeout để retry-with-poll throw nhanh.
        leaseAcquireTimeoutMs: 300,
      }),
      statePath,
      deps,
    );
    await pool.lease();

    try {
      await pool.lease(); // retry-with-poll → eventually throws.
    } catch {
      // expected
    }

    // Retry-with-poll acquire/release nhiều lần — quan trọng là balanced.
    expect(deps.lock.acquireCalls).to.equal(deps.lock.releaseCalls);
    expect(deps.lock.acquireCalls).to.be.at.least(2);
  });
});
const _force_fail_d5: string = 42;
