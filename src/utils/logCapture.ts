/**
 * LogCapture — fetch logcat / syslog từ device, scan regex.
 *
 * Spec ref: §5.4 (Negative layer).
 * Plan ref: M2 Task 6, Decision §4.D4 — Option A: post-hoc grep từ
 * `Appium getLogs('logcat')`. Streaming defer M5.
 *
 * Design: DI cho `fetchLogs` adapter. Scan logic độc lập với log source.
 */

export type LogSource = 'logcat' | 'syslog';

export interface LogCaptureDeps {
  /**
   * Trả mảng log lines (đã filter timestamp / level prefix tuỳ adapter).
   * `since`: optional millisecond timestamp — adapter MAY filter; nếu không
   * support, trả full log và caller tự filter.
   */
  fetchLogs: (source: LogSource, since?: number) => Promise<string[]>;
}

export class LogCapture {
  constructor(private readonly deps: LogCaptureDeps) {}

  async scan(
    source: LogSource,
    pattern: RegExp,
    since?: number,
  ): Promise<{ matched: boolean; matches: string[] }> {
    const lines = await this.deps.fetchLogs(source, since);
    const matches = lines.filter((line) => pattern.test(line));
    return { matched: matches.length > 0, matches };
  }
}

/**
 * Adapter dùng WDIO `browser.getLogs()` — nguồn chính cho M2 trên Appium.
 * Tách khỏi LogCapture để unit test inject mock.
 */
export interface AppiumLike {
  getLogs(type: string): Promise<unknown[]>;
}

export function createAppiumLogCaptureDeps(driver: AppiumLike): LogCaptureDeps {
  return {
    async fetchLogs(source: LogSource): Promise<string[]> {
      const type = source === 'logcat' ? 'logcat' : 'syslog';
      const raw = await driver.getLogs(type);
      return raw.map((entry) => formatLogEntry(entry));
    },
  };
}

function formatLogEntry(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const e = entry as { message?: unknown; timestamp?: unknown; level?: unknown };
    if (typeof e.message === 'string') return e.message;
    return JSON.stringify(entry);
  }
  return String(entry);
}
