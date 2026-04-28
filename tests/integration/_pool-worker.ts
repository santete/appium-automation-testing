/**
 * Worker child cho `account-pool-concurrency.spec.ts`.
 *
 * Plan ref: M3 Task 21.
 *
 * Lease 1 account theo role nhận từ argv, hold cho `holdMs`, release. Send IPC
 * messages về parent với timeline { leasedAt, releasedAt, username }.
 *
 * Argv: <configPath> <statePath> <role> <holdMs>
 */
import * as path from 'node:path';
import { AccountPool, loadPoolConfig } from '../../src/utils/accountPool/AccountPool';
import { sleep } from '../../src/utils/sleep';

async function main(): Promise<void> {
  const [configPath, statePath, role, holdMsRaw] = process.argv.slice(2);
  const holdMs = Number(holdMsRaw);
  if (!configPath || !statePath || !role || !Number.isFinite(holdMs)) {
    throw new Error(`worker: invalid argv: ${process.argv.slice(2).join(' ')}`);
  }

  const config = loadPoolConfig(path.resolve(configPath));
  const pool = new AccountPool(config, path.resolve(statePath));

  const t0 = Date.now();
  const account = await pool.lease(role);
  const leasedAt = Date.now();

  process.send?.({ kind: 'leased', username: account.username, leasedAt, waitedMs: leasedAt - t0 });

  await sleep(holdMs);

  await pool.release(account);
  const releasedAt = Date.now();

  process.send?.({ kind: 'released', username: account.username, releasedAt });
}

main().catch((err) => {
  process.send?.({ kind: 'error', message: (err as Error).message });
  process.exit(1);
});
