/**
 * Sauce Labs RDC (Real Device Cloud) config — STUB cho M5+ activation.
 *
 * Plan ref: M4 §3 (in scope) + M4 Decision 3 (Q2 sign-off 2026-04-28 —
 * "config-driven nếu cần thiết").
 *
 * Status M4: STUB — không wire actual SL account. Song song với `wdio.bs.ts`
 * cho phép M5+ chọn provider mà không phải re-architect.
 *
 * M5+ activation checklist:
 *   1. Phuc DN có account Sauce Labs.
 *   2. Add `SAUCE_USERNAME`, `SAUCE_ACCESS_KEY`, `SAUCE_APP_STORAGE_ID`
 *      vào GH Secrets + `.env.local`. Guard throw bên dưới sẽ tự pass khi
 *      cả 3 env có giá trị non-empty.
 *   3. Upload APK lên Sauce Storage qua REST API → nhận `storage:filename=...`
 *      → set `SAUCE_APP_STORAGE_ID`.
 *   4. Override `hostname` theo region: `ondemand.<region>.saucelabs.com`
 *      (us-west-1, eu-central-1).
 *   5. Add service: `services: ['sauce']` (npm i @wdio/sauce-service).
 *   6. Verify smoke E2E qua SL.
 *
 * KHÔNG dùng file này M4. Smoke E2E giữ local-dev (xem wdio.local.ts).
 *
 * Provider khác: xem `wdio.bs.ts` cho BrowserStack stub song song.
 */
import type { Options } from '@wdio/types';
import * as path from 'node:path';
import { loadEnv } from './index';

const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

// Stub guard: throw khi chưa fill creds → fail-fast tránh boot session với
// placeholder. M5+ fill SAUCE_* env → guard tự pass, capability `appium:app`
// + `sauce:options` block bên dưới uncomment để wire thật.
if (!env.SAUCE_USERNAME || !env.SAUCE_ACCESS_KEY || !env.SAUCE_APP_STORAGE_ID) {
  throw new Error(
    'wdio.sauce.ts STUB — yêu cầu SAUCE_USERNAME, SAUCE_ACCESS_KEY, SAUCE_APP_STORAGE_ID trong .env.local. ' +
      'M4 (Q2 sign-off 2026-04-28): KHÔNG wire device farm — smoke E2E chạy local qua wdio.local.ts. ' +
      'Xem header file để biết M5+ activation checklist.',
  );
}

export const config: Options.Testrunner = {
  runner: 'local',

  // M5+ uncomment + chọn region:
  // hostname: 'ondemand.us-west-1.saucelabs.com',
  // port: 443,
  // path: '/wd/hub',
  // protocol: 'https',

  // M5+ wire qua service config:
  // user: env.SAUCE_USERNAME,
  // key: env.SAUCE_ACCESS_KEY,
  // region: 'us',

  specs: ['../../tests/**/*.spec.ts'],
  suites: {
    smoke: ['../../tests/smoke/**/*.spec.ts'],
    regression: ['../../tests/regression/**/*.spec.ts'],
  },

  maxInstances: 4,

  capabilities: [
    {
      platformName: 'Android',
      'appium:deviceName': env.ANDROID_DEVICE_NAME,
      'appium:platformVersion': env.ANDROID_PLATFORM_VERSION,
      'appium:automationName': 'UiAutomator2',
      'appium:app': `storage:${env.SAUCE_APP_STORAGE_ID}`,
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:newCommandTimeout': 240,
      // M5+ uncomment + fill:
      // 'sauce:options': {
      //   name: 'M5+ smoke',
      //   build: process.env.GITHUB_RUN_ID ?? 'local-dev',
      //   tags: ['mobile', 'android', 'smoke'],
      //   recordScreenshots: true,
      //   recordVideo: true,
      // },
    },
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: env.DEFAULT_WAIT_TIMEOUT,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // M5+ thêm: services: ['sauce']
  services: [],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 90_000,
    require: [path.resolve(__dirname, '../../tests/_hooks/global.ts')],
  },

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'reports/allure-results',
      },
    ],
  ],

  afterTest: async function (test, _context, { error }) {
    if (!error) return;
    try {
      const screenshot = await browser.takeScreenshot();
      const allureReporter = (await import('@wdio/allure-reporter')).default;
      allureReporter.addAttachment(
        `Failure screenshot — ${test.title}`,
        Buffer.from(screenshot, 'base64'),
        'image/png',
      );
    } catch (hookErr) {
      console.error('afterTest hook failed:', hookErr);
    }
  },
};
