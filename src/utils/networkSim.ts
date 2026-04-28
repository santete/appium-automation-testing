/**
 * Network simulation wrapper qua Appium `mobile:networkSpeed` (Android).
 *
 * Plan ref: M3 Decision 5, Task 11.
 *
 * Giới hạn: chỉ Android emulator. Real device + iOS defer M5 (Toxiproxy).
 */

export type NetworkProfile = 'full' | 'lte' | 'umts' | 'edge' | 'gprs' | 'none';

export interface NetworkSimDeps {
  /**
   * Execute Appium mobile command. Driver-agnostic — receive command + args,
   * delegate `browser.execute` hoặc equivalent.
   */
  executeMobileCommand(command: string, args: Record<string, unknown>): Promise<unknown>;
}

export class NetworkSim {
  constructor(private readonly deps: NetworkSimDeps) {}

  /**
   * Set network speed cho Android emulator.
   *
   * Profile mapping (theo Android emulator console):
   *   - full = no throttle (default)
   *   - lte / umts / edge / gprs = increasing latency + smaller bandwidth
   *   - none = airplane mode (offline)
   */
  async setSpeed(profile: NetworkProfile): Promise<void> {
    await this.deps.executeMobileCommand('mobile: networkSpeed', { speed: profile });
  }
}

/** Runtime adapter wrap WDIO `browser` cho NetworkSim. */
export function createWdioNetworkSimDeps(driver: {
  execute: (script: string, args: Record<string, unknown>) => Promise<unknown>;
}): NetworkSimDeps {
  return {
    async executeMobileCommand(command: string, args: Record<string, unknown>): Promise<unknown> {
      return driver.execute(command, args);
    },
  };
}
