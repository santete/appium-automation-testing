/**
 * Mocha root hook plugin — global beforeEach/afterEach cho mọi test.
 *
 * Plan ref: M3 Task 13.
 *
 * Behaviors:
 *  - `beforeEach`: lease 1 account từ pool (role default 'standard'),
 *    expose qua `globalThis.testAccount`.
 *  - `afterEach`: release account về pool, KHÔNG throw kể cả test fail.
 *
 * Loaded qua `mochaOpts.require` trong wdio.local.ts / wdio.staging.ts.
 *
 * Account pool state file ở `tmp/account-pool.state.json` để cross-process
 * safe khi M4 shard (multiple worker cùng filesystem). Lease timeout 30s
 * thoả đáng vì smoke test < 30s cho lease/release.
 */
import * as path from 'node:path';
import { AccountPool, loadPoolConfig } from '../../src/utils/accountPool/AccountPool';
import { UserFactory, type UserArtifact } from '../../src/factories/UserFactory';
import { logger } from '../../src/utils/logger';
import { loadEnv } from '../../src/config/index';

declare global {
  // eslint-disable-next-line no-var
  var testAccount: { username: string; password: string; roles: string[] } | undefined;
}

let factory: UserFactory | null = null;
let currentArtifact: UserArtifact | null = null;

function getFactory(): UserFactory {
  if (factory) return factory;

  const env = loadEnv();
  const repoRoot = path.resolve(__dirname, '../..');
  const configPath = path.resolve(repoRoot, env.ACCOUNT_POOL_CONFIG_PATH);
  const statePath = path.resolve(repoRoot, env.ACCOUNT_POOL_STATE_PATH);

  const config = loadPoolConfig(configPath);
  const pool = new AccountPool(config, statePath);
  factory = new UserFactory(pool);
  return factory;
}

export const mochaHooks = {
  async beforeEach(this: Mocha.Context) {
    // `this.currentTest` available trong mocha context.
    const testTitle = this.currentTest?.fullTitle() ?? 'unknown-test';
    // Default role = 'standard'. Spec có thể override sau (M3 không support
    // per-test role qua hook — defer M4 nếu cần fixture metadata).
    currentArtifact = await getFactory().setup({ testId: testTitle }, { role: 'standard' });
    globalThis.testAccount = {
      username: currentArtifact.username,
      password: currentArtifact.password,
      roles: currentArtifact.roles,
    };
  },

  async afterEach() {
    if (!currentArtifact) return;
    try {
      await currentArtifact.cleanup();
    } catch (e) {
      logger.error('afterEach cleanup failed', { error: (e as Error).message });
    } finally {
      currentArtifact = null;
      globalThis.testAccount = undefined;
    }
  },
};
