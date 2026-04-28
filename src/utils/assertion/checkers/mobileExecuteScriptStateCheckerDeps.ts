/**
 * Runtime adapter — read state qua Appium `mobile: shell` script (UiAutomator2).
 *
 * Plan ref: M3 Task 18, D4 repay.
 *
 * Thay thế adb adapter trong context release APK + Appium session đã active.
 * `mobile: shell` chạy shell command qua adb của Appium server, không cần
 * `adb` binary trong PATH của test runner. Yêu cầu: Appium 2 + uiautomator2
 * driver + capability `appium:relaxedSecurityEnabled = true` (hoặc allowlist
 * `mobile: shell` qua `--allow-insecure adb_shell`).
 *
 * M3 scope: chỉ implement `source: 'shared_prefs'`. Các source khác throw
 * NotImplementedError — defer M5.
 *
 * SECURITY: validate `package` ký tự an toàn (Android pkg regex) trước khi
 * pass vào `run-as`. `mobile: shell` truyền args mảng, KHÔNG concat shell
 * string → không bị command injection.
 */
import type { StateCheckerDeps, StateLookupArgs } from './StateChecker';
import { ANDROID_PKG_REGEX, extractPrefValue } from './sharedPrefsParser';

export class NotImplementedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotImplementedError';
  }
}

/**
 * Driver shape Appium runtime cung cấp. WDIO `browser` thoả; tương thích Appium
 * Node client `driver` qua aliasing.
 */
export interface MobileExecuteScriptDriver {
  execute: (script: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Output shape của `mobile: shell` — Appium 2 + uiautomator2 trả string stdout
 * trực tiếp. Một số driver wrap thành `{ stdout, stderr }`. Adapter handle cả 2.
 */
function extractStdout(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'stdout' in raw) {
    const stdout = (raw as { stdout: unknown }).stdout;
    if (typeof stdout === 'string') return stdout;
  }
  return '';
}

export function createMobileExecuteScriptStateCheckerDeps(
  driver: MobileExecuteScriptDriver,
): StateCheckerDeps {
  async function shell(command: string, args: string[]): Promise<string> {
    const raw = await driver.execute('mobile: shell', { command, args });
    return extractStdout(raw);
  }

  return {
    async getValue(args: StateLookupArgs): Promise<string | null> {
      if (args.source !== 'shared_prefs') {
        throw new NotImplementedError(
          `mobile:executeScript adapter M3 only supports source='shared_prefs', got '${args.source}' (defer M5)`,
        );
      }
      if (!args.package || !ANDROID_PKG_REGEX.test(args.package)) {
        throw new Error(`invalid Android package name: ${args.package ?? '<undefined>'}`);
      }

      const pkg = args.package;
      const lsOut = await shell('run-as', [pkg, 'ls', `/data/data/${pkg}/shared_prefs/`]);
      const files = lsOut
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.endsWith('.xml'));

      for (const file of files) {
        let xml: string;
        try {
          xml = await shell('run-as', [pkg, 'cat', `/data/data/${pkg}/shared_prefs/${file}`]);
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
