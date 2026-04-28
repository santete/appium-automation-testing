/**
 * UserFactory — wrap AccountPool, return account artifact với auto cleanup.
 *
 * Plan ref: M3 Decision 1-3, Task 6.
 *
 * Usage:
 *   const factory = new UserFactory(pool);
 *   const user = await factory.setup({ testId: 'TC_LOGIN_001' }, { role: 'standard' });
 *   // ... test sử dụng user.username/password
 *   await user.cleanup();  // release back to pool
 */
import { logger } from '../utils/logger';
import { Factory, type FactoryArtifact, type FactorySetupContext } from './_base';
import { AccountPool, type LeasedAccount } from '../utils/accountPool/AccountPool';

export interface UserFactoryOptions {
  /**
   * Filter pool theo role. Nếu `undefined` → bất kỳ account available.
   * Ví dụ: 'standard', 'locked_out', 'problem'.
   */
  role?: string;
}

export interface UserArtifact extends FactoryArtifact {
  username: string;
  password: string;
  roles: string[];
}

export class UserFactory extends Factory<UserArtifact, UserFactoryOptions> {
  constructor(private readonly pool: AccountPool) {
    super();
  }

  async setup(ctx: FactorySetupContext, options: UserFactoryOptions = {}): Promise<UserArtifact> {
    const account = await this.pool.lease(options.role);
    logger.info('UserFactory.setup leased', {
      testId: ctx.testId,
      username: account.username,
      role: options.role ?? 'any',
    });

    const cleanup = async (): Promise<void> => {
      await this.pool.release(account);
      logger.info('UserFactory.cleanup released', {
        testId: ctx.testId,
        username: account.username,
      });
    };

    return {
      username: account.username,
      password: account.password,
      roles: account.roles,
      cleanup,
    };
  }

  /** Direct lease/release pass-through (advanced use; prefer setup/cleanup). */
  async lease(role?: string): Promise<LeasedAccount> {
    return this.pool.lease(role);
  }

  async release(account: LeasedAccount): Promise<void> {
    return this.pool.release(account);
  }
}
