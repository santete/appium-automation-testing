/**
 * Runtime adapter — read state qua `adb shell run-as <pkg>` (debuggable APK).
 *
 * Plan ref: Decision §4.D2 (adb fallback), Debt D4 (M2 = adb only).
 *
 * M2 scope: chỉ implement `source: 'shared_prefs'`. Quét toàn bộ `*.xml` trong
 * `shared_prefs/` và parse `<string name="...">value</string>` (Android default
 * format). Các source khác throw `NotImplementedError` rõ ràng — repay ở M3+.
 *
 * SECURITY: dùng `execFile` (không shell) + validate `package` ký tự an toàn
 * trước khi pass vào `run-as` để tránh command injection.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { StateCheckerDeps, StateLookupArgs } from './StateChecker';
import { ANDROID_PKG_REGEX, extractPrefValue } from './sharedPrefsParser';

const execFileAsync = promisify(execFile);

export interface AdbAdapterOptions {
  /** Optional `adb -s <id>` để target device cụ thể trong multi-device setup. */
  deviceId?: string;
  /** Path tới `adb` binary; default `'adb'` (lấy từ PATH). */
  adbPath?: string;
}

export class NotImplementedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotImplementedError';
  }
}

export function createAdbStateCheckerDeps(opts: AdbAdapterOptions = {}): StateCheckerDeps {
  const adb = opts.adbPath ?? 'adb';
  const deviceArgs = opts.deviceId ? ['-s', opts.deviceId] : [];

  return {
    async getValue(args: StateLookupArgs): Promise<string | null> {
      if (args.source !== 'shared_prefs') {
        throw new NotImplementedError(
          `adb adapter M2 only supports source='shared_prefs', got '${args.source}' (Debt D4: extend M3+)`,
        );
      }
      if (!args.package || !ANDROID_PKG_REGEX.test(args.package)) {
        throw new Error(`invalid Android package name: ${args.package ?? '<undefined>'}`);
      }

      const pkg = args.package;
      const lsArgs = [
        ...deviceArgs,
        'shell',
        'run-as',
        pkg,
        'ls',
        `/data/data/${pkg}/shared_prefs/`,
      ];
      let lsOut: string;
      try {
        const { stdout } = await execFileAsync(adb, lsArgs, { timeout: 10_000 });
        lsOut = stdout;
      } catch (err) {
        throw new Error(`adb run-as ${pkg} ls failed: ${errMsg(err)}`);
      }

      const files = lsOut
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.endsWith('.xml'));

      for (const file of files) {
        const catArgs = [
          ...deviceArgs,
          'shell',
          'run-as',
          pkg,
          'cat',
          `/data/data/${pkg}/shared_prefs/${file}`,
        ];
        let xml: string;
        try {
          const { stdout } = await execFileAsync(adb, catArgs, { timeout: 10_000 });
          xml = stdout;
        } catch {
          continue;
        }
        const value = extractPrefValue(xml, args.key);
        if (value !== null) return value;
      }
      return null;
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
