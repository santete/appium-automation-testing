/**
 * Integration test (D4 carry-over) — verify `mobileExecuteScriptStateCheckerDeps`
 * end-to-end trên real Android device qua state-test debuggable APK.
 *
 * Plan ref: M4 Task 15, Decision 11; M3 Task 19 (D4 unit logic).
 *
 * Gating:
 *   - `RUN_REAL_DEVICE=1` env required → CI skip toàn bộ describe block.
 *   - Appium 2 server phải chạy localhost:4723 trước khi test (start qua
 *     `appium --allow-insecure adb_shell` hoặc `--relaxed-security`).
 *   - APK `apps/state-test-debug.apk` phải build trước (qua
 *     `npm run build:test-apk`).
 *   - Android device USB-connected + `adb devices` show 1 device authorized.
 *
 * Flow:
 *   1. `remote()` boot Appium session với capability install + launch state-test.
 *   2. Wait MainActivity active (writes `m4_state_test_key=ok` trong `onCreate`).
 *   3. Lookup qua `mobile:executeScript` adapter → assert `'ok'`.
 *   4. Cleanup session + uninstall.
 *
 * KHÔNG chạy trong CI (no device) — gated by RUN_REAL_DEVICE; Phuc verify
 * thủ công 1 lần ship M4 (per Decision 11).
 */
import { expect } from 'chai';
import * as path from 'node:path';
import { remote, type RemoteOptions } from 'webdriverio';
import { StateChecker } from '../../src/utils/assertion/checkers/StateChecker';
import { createMobileExecuteScriptStateCheckerDeps } from '../../src/utils/assertion/checkers/mobileExecuteScriptStateCheckerDeps';

const SHOULD_RUN = process.env.RUN_REAL_DEVICE === '1';
const PKG = 'com.santete.statetest';
const ACTIVITY = `${PKG}.MainActivity`;
const APK_PATH = path.resolve(__dirname, '..', '..', 'apps', 'state-test-debug.apk');

const describeIfDevice = SHOULD_RUN ? describe : describe.skip;

describeIfDevice('Integration (REAL DEVICE): mobile:executeScript state lookup', function () {
  this.timeout(120_000);

  let driver: Awaited<ReturnType<typeof remote>>;

  before(async () => {
    const deviceName = process.env.ANDROID_DEVICE_NAME ?? 'Android Device';
    const platformVersion = process.env.ANDROID_PLATFORM_VERSION ?? '13';

    const opts: RemoteOptions = {
      hostname: process.env.APPIUM_HOST ?? 'localhost',
      port: Number(process.env.APPIUM_PORT ?? 4723),
      logLevel: 'warn',
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': deviceName,
        'appium:platformVersion': platformVersion,
        'appium:automationName': 'UiAutomator2',
        'appium:app': APK_PATH,
        'appium:appPackage': PKG,
        'appium:appActivity': ACTIVITY,
        'appium:autoGrantPermissions': true,
        'appium:noReset': false,
        'appium:newCommandTimeout': 240,
        'appium:appWaitActivity': '*',
        'appium:appWaitDuration': 30000,
      },
    };

    driver = await remote(opts);
  });

  after(async () => {
    if (!driver) return;
    try {
      await driver.execute('mobile: removeApp', { appId: PKG });
    } catch {
      // ignore — app có thể đã removed
    }
    await driver.deleteSession();
  });

  it('default prefs: m4_state_test_key === "ok" qua mobile: shell run-as', async () => {
    const checker = new StateChecker(
      createMobileExecuteScriptStateCheckerDeps({
        execute: (script, args) => driver.execute(script, args),
      }),
    );

    const out = await checker.run({
      id: 'state.m4_default',
      type: 'state_property',
      severity: 'critical',
      source: 'shared_prefs',
      package: PKG,
      key: 'm4_state_test_key',
      expect: { equals: 'ok' },
    });

    expect(out.passed, `state lookup fail: ${out.message ?? '<no message>'}`).to.equal(true);
  });

  it('lookup absent key → not_null fail (negative path)', async () => {
    const checker = new StateChecker(
      createMobileExecuteScriptStateCheckerDeps({
        execute: (script, args) => driver.execute(script, args),
      }),
    );

    const out = await checker.run({
      id: 'state.m4_absent',
      type: 'state_property',
      severity: 'medium',
      source: 'shared_prefs',
      package: PKG,
      key: 'definitely_not_exists_xyz',
      expect: { not_null: true },
    });

    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('expected not_null');
  });
});
