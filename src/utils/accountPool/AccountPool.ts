/**
 * AccountPool — lease/release Sauce Demo users với cross-process safety.
 *
 * Plan ref: M3 Decision 1-3, 8.
 *
 * Semantics:
 *  - `lease(role?)`: tìm 1 account `inUse=false` matching role (hoặc bất kỳ
 *    nếu role không cho), flip `inUse=true`, write state, release lock. Throw
 *    `NoAccountAvailableError` nếu hết account sau timeout.
 *  - `release(account)`: flip `inUse=false`, clear `leasedAt`. Idempotent —
 *    release account chưa lease KHÔNG throw (defensive).
 *  - Stale reclaim: account có `leasedAt` cũ hơn `staleLeaseTimeoutMs` →
 *    auto-released khi process khác lease (defensive cho process crash).
 *
 * State file format (JSON):
 *  {
 *    "leases": {
 *      "<username>": { "inUse": boolean, "leasedAt": ISO | null, "leasedBy": string | null }
 *    }
 *  }
 */
import { promises as fs, readFileSync } from 'node:fs';
import { z } from 'zod';
import { properFileLockDeps, type FileLockDeps } from './fileLock';
import { sleep } from '../sleep';

export interface UserDescriptor {
  username: string;
  roles: string[];
  notes?: string;
}

export interface PoolConfig {
  password: string;
  staleLeaseTimeoutMs: number;
  leaseAcquireTimeoutMs: number;
  users: UserDescriptor[];
}

export interface LeasedAccount {
  username: string;
  password: string;
  roles: string[];
}

export class NoAccountAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoAccountAvailableError';
  }
}

export interface AccountPoolDeps {
  fileLock: FileLockDeps;
  /** ISO timestamp source — DI-friendly cho unit test. */
  now: () => Date;
  /** Process identifier — default `process.pid` string. */
  ownerId: () => string;
}

const LeaseEntrySchema = z.object({
  inUse: z.boolean(),
  leasedAt: z.union([z.string(), z.null()]),
  leasedBy: z.union([z.string(), z.null()]),
});

const StateSchema = z.object({
  leases: z.record(z.string(), LeaseEntrySchema),
});

type State = z.infer<typeof StateSchema>;

export const defaultAccountPoolDeps: AccountPoolDeps = {
  fileLock: properFileLockDeps,
  now: () => new Date(),
  ownerId: () => `pid-${process.pid}`,
};

export class AccountPool {
  constructor(
    private readonly config: PoolConfig,
    private readonly statePath: string,
    private readonly deps: AccountPoolDeps = defaultAccountPoolDeps,
  ) {
    if (config.users.length === 0) {
      throw new Error('AccountPool: config.users phải có ít nhất 1 user');
    }
  }

  /**
   * Lease 1 account.
   *
   * Retry-with-poll: nếu pool hết, sleep `pollIntervalMs` rồi retry tới khi
   * `leaseAcquireTimeoutMs` budget cạn. Cross-process semantics: process 2
   * lease cùng role single-account → BLOCK tới khi process 1 release (M3
   * Acceptance §2.4).
   *
   * @param role - Nếu cho, chỉ lease account có role này; nếu không, lease
   *   account đầu tiên available (round-robin theo file order).
   */
  async lease(role?: string): Promise<LeasedAccount> {
    await this.deps.fileLock.ensureFile(this.statePath, this.serializeInitialState());

    // Deadline dùng wall-clock (`Date.now()`) thay vì `deps.now()` để
    // independent với DI clock — frozen-clock unit test sẽ time out qua
    // setTimeout wall-clock (consistent với poll sleep).
    const startWallMs = Date.now();
    const deadlineWall = startWallMs + this.config.leaseAcquireTimeoutMs;
    const pollIntervalMs = 200;

    for (;;) {
      const release = await this.deps.fileLock.acquire(this.statePath, {
        timeoutMs: this.config.leaseAcquireTimeoutMs,
      });
      try {
        const state = await this.readState();
        this.reclaimStaleLeases(state);

        const candidate = this.findAvailable(state, role);
        if (candidate) {
          const nowIso = this.deps.now().toISOString();
          state.leases[candidate.username] = {
            inUse: true,
            leasedAt: nowIso,
            leasedBy: this.deps.ownerId(),
          };
          await this.writeState(state);
          return {
            username: candidate.username,
            password: this.config.password,
            roles: candidate.roles,
          };
        }
      } finally {
        await release();
      }

      if (Date.now() >= deadlineWall) {
        const reason = role
          ? `Không có account nào với role "${role}" available trong pool sau ${this.config.leaseAcquireTimeoutMs}ms`
          : `Toàn bộ pool đang in-use sau ${this.config.leaseAcquireTimeoutMs}ms`;
        throw new NoAccountAvailableError(reason);
      }
      await sleep(pollIntervalMs);
    }
  }

  /**
   * Release account về pool. Idempotent — không throw nếu account đã released.
   */
  async release(account: LeasedAccount): Promise<void> {
    await this.deps.fileLock.ensureFile(this.statePath, this.serializeInitialState());

    const release = await this.deps.fileLock.acquire(this.statePath, {
      timeoutMs: this.config.leaseAcquireTimeoutMs,
    });

    try {
      const state = await this.readState();
      const entry = state.leases[account.username];
      // Defensive: nếu account không trong pool config hiện tại (sau hot-reload
      // pool.config.json), bỏ qua. Nếu chưa lease, cũng bỏ qua.
      if (!entry || !entry.inUse) {
        return;
      }
      state.leases[account.username] = {
        inUse: false,
        leasedAt: null,
        leasedBy: null,
      };
      await this.writeState(state);
    } finally {
      await release();
    }
  }

  /**
   * Inspect (no lock) — chỉ dùng cho debug + integration test verification.
   */
  async inspect(): Promise<State> {
    await this.deps.fileLock.ensureFile(this.statePath, this.serializeInitialState());
    return this.readState();
  }

  private findAvailable(state: State, role?: string): UserDescriptor | undefined {
    return this.config.users.find((u) => {
      const entry = state.leases[u.username];
      if (entry?.inUse) return false;
      if (role && !u.roles.includes(role)) return false;
      return true;
    });
  }

  private reclaimStaleLeases(state: State): void {
    const cutoff = this.deps.now().getTime() - this.config.staleLeaseTimeoutMs;
    for (const [username, entry] of Object.entries(state.leases)) {
      if (!entry.inUse || !entry.leasedAt) continue;
      const leasedAtMs = Date.parse(entry.leasedAt);
      if (Number.isFinite(leasedAtMs) && leasedAtMs < cutoff) {
        state.leases[username] = { inUse: false, leasedAt: null, leasedBy: null };
      }
    }
  }

  private async readState(): Promise<State> {
    const raw = await fs.readFile(this.statePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `AccountPool: state file ${this.statePath} không phải JSON hợp lệ — ${(e as Error).message}`,
      );
    }
    const result = StateSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `AccountPool: state file ${this.statePath} schema invalid — ${result.error.message}`,
      );
    }
    // Hydrate missing entries cho user mới thêm vào pool.config.json sau khi
    // state đã tạo.
    for (const u of this.config.users) {
      if (!result.data.leases[u.username]) {
        result.data.leases[u.username] = { inUse: false, leasedAt: null, leasedBy: null };
      }
    }
    return result.data;
  }

  private async writeState(state: State): Promise<void> {
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private serializeInitialState(): string {
    const initial: State = { leases: {} };
    for (const u of this.config.users) {
      initial.leases[u.username] = { inUse: false, leasedAt: null, leasedBy: null };
    }
    return JSON.stringify(initial, null, 2);
  }
}

export function loadPoolConfig(configPath: string): PoolConfig {
  // Sync read OK — config load 1 lần lúc init.
  const raw = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    password: String(parsed.password),
    staleLeaseTimeoutMs: Number(parsed.staleLeaseTimeoutMs ?? 300_000),
    leaseAcquireTimeoutMs: Number(parsed.leaseAcquireTimeoutMs ?? 30_000),
    users: (parsed.users as UserDescriptor[]) ?? [],
  };
}
