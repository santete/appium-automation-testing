/**
 * Integration test — AccountPool cross-process locking.
 *
 * Plan ref: M3 Task 21, Acceptance §2.4.
 *
 * Fork 2 Node workers cùng lease role='smoke' (chỉ `standard_user` match).
 * Verify mutual exclusion: timeline lease/release của 2 workers KHÔNG overlap,
 * worker thứ 2 wait cho worker thứ 1 release. Cả 2 cùng nhận `standard_user`.
 *
 * Riêng test 2: 2 workers lease role='regression' (3 accounts match) → cả 2
 * lease song song khác account, không block.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { expect } from 'chai';

interface WorkerEvent {
  kind: 'leased' | 'released' | 'error';
  username?: string;
  leasedAt?: number;
  releasedAt?: number;
  waitedMs?: number;
  message?: string;
}

interface WorkerOutcome {
  leased: WorkerEvent;
  released: WorkerEvent;
}

const REPO_ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.resolve(REPO_ROOT, 'src/utils/accountPool/pool.config.json');
const TMP_DIR = path.resolve(REPO_ROOT, 'tmp');
const WORKER_SCRIPT = path.resolve(__dirname, '_pool-worker.ts');

function spawnWorker(statePath: string, role: string, holdMs: number): Promise<WorkerOutcome> {
  return new Promise((resolve, reject) => {
    const events: WorkerEvent[] = [];
    const child: ChildProcess = fork(
      WORKER_SCRIPT,
      [CONFIG_PATH, statePath, role, String(holdMs)],
      {
        execArgv: ['--require', 'ts-node/register', '--no-experimental-strip-types'],
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      },
    );
    child.on('message', (msg) => events.push(msg as WorkerEvent));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        const errEvent = events.find((e) => e.kind === 'error');
        return reject(new Error(`worker exit ${code}: ${errEvent?.message ?? 'unknown'}`));
      }
      const leased = events.find((e) => e.kind === 'leased');
      const released = events.find((e) => e.kind === 'released');
      if (!leased || !released) {
        return reject(new Error(`worker missing events: ${JSON.stringify(events)}`));
      }
      resolve({ leased, released });
    });
  });
}

async function freshStatePath(name: string): Promise<string> {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const p = path.resolve(TMP_DIR, `pool-state-${name}-${process.pid}.json`);
  await fs.rm(p, { force: true });
  await fs.rm(`${p}.lock`, { recursive: true, force: true });
  return p;
}

describe('Integration: AccountPool cross-process concurrency', function () {
  this.timeout(45_000);

  it('2 workers contend trên cùng role → mutual exclusion (no overlap)', async () => {
    const statePath = await freshStatePath('contend');
    const HOLD_MS = 1500;

    const [w1, w2] = await Promise.all([
      spawnWorker(statePath, 'smoke', HOLD_MS),
      spawnWorker(statePath, 'smoke', HOLD_MS),
    ]);

    expect(w1.leased.username).to.equal('standard_user');
    expect(w2.leased.username).to.equal('standard_user');

    // Sort theo thứ tự lease
    const [first, second] = [w1, w2].sort(
      (a, b) => (a.leased.leasedAt ?? 0) - (b.leased.leasedAt ?? 0),
    );

    // Worker đến sau phải lease SAU khi worker đầu release (mutual exclusion).
    // Allow 50ms slack cho file lock + state write.
    expect(second.leased.leasedAt!).to.be.at.least(first.released.releasedAt! - 50);

    // Worker đến sau phải đã chờ ≥ HOLD_MS - slack
    expect(second.leased.waitedMs!).to.be.at.least(HOLD_MS - 200);
  });

  it('2 workers role có nhiều accounts → lease song song khác account', async () => {
    const statePath = await freshStatePath('parallel');
    const HOLD_MS = 800;

    const [w1, w2] = await Promise.all([
      spawnWorker(statePath, 'regression', HOLD_MS),
      spawnWorker(statePath, 'regression', HOLD_MS),
    ]);

    // 3 accounts có role 'regression' (standard_user, problem_user, visual_user).
    // 2 workers nên nhận 2 username khác nhau, lease overlap.
    expect(w1.leased.username).to.not.equal(w2.leased.username);

    const [first, second] = [w1, w2].sort(
      (a, b) => (a.leased.leasedAt ?? 0) - (b.leased.leasedAt ?? 0),
    );

    // Lease overlap: second lease trước first release (parallel access)
    expect(second.leased.leasedAt!).to.be.lessThan(first.released.releasedAt!);
  });
});
