/**
 * Cross-process file lock wrapper around `proper-lockfile`.
 *
 * Plan ref: M3 Decision 8 (proper-lockfile chosen over custom O_EXCL).
 *
 * Tách wrapper để:
 *  1. AccountPool không phụ thuộc trực tiếp vào lib (DI-friendly).
 *  2. Unit test mock được qua Deps interface.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import lockfile from 'proper-lockfile';

export interface FileLockDeps {
  acquire(filePath: string, opts: AcquireOpts): Promise<() => Promise<void>>;
  ensureFile(filePath: string, defaultContent: string): Promise<void>;
}

export interface AcquireOpts {
  /** Total budget chờ lock (ms). */
  timeoutMs: number;
  /** Retry interval khi lock đang held bởi process khác. */
  retryIntervalMs?: number;
}

/**
 * Default impl dùng `proper-lockfile`.
 *
 * `proper-lockfile` lock theo file thật (`<filePath>.lock` directory created
 * atomically). Stale lock auto-released sau `stale` ms — set = staleLease
 * timeout của pool để align semantics.
 */
export const properFileLockDeps: FileLockDeps = {
  async ensureFile(filePath: string, defaultContent: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, defaultContent, 'utf8');
    }
  },

  async acquire(filePath: string, opts: AcquireOpts): Promise<() => Promise<void>> {
    const retryInterval = opts.retryIntervalMs ?? 100;
    // proper-lockfile retries: tổng wait ≈ retries × maxTimeout. Chọn retries
    // sao cho retries × retryInterval ≥ timeoutMs.
    const retries = Math.max(1, Math.ceil(opts.timeoutMs / retryInterval));

    const release = await lockfile.lock(filePath, {
      retries: {
        retries,
        minTimeout: retryInterval,
        maxTimeout: retryInterval,
        factor: 1,
      },
      // Stale = 5 phút align với pool's staleLeaseTimeoutMs.
      stale: 5 * 60 * 1000,
    });
    return release;
  },
};
