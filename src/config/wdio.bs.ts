/**
 * BrowserStack device farm config — STUB cho M5+ activation.
 *
 * Plan ref: M4 §3 (in scope) + M4 Decision 3 (Q2 sign-off 2026-04-28 —
 * "chưa cần device farm bây giờ, ưu tiên real device dev, config-driven nếu
 * cần thiết").
 *
 * Status M4: STUB — không wire actual BS account. File tồn tại để:
 *   1. Lock-in shape của capabilities + service config sẵn sàng cho M5+ swap.
 *   2. Force fail-fast khi caller lỡ trỏ vào trước khi creds có sẵn.
 *   3. Reviewer thấy được "M4 đã chừa chỗ cho device farm" mà không phải
 *      re-architect khi M5 unblock.
 *
 * M5+ activation checklist (KHÔNG modify file này khi mới review):
 *   1. Phuc DN có account BrowserStack (FPT org hoặc personal).
 *   2. Add `BS_USERNAME`, `BS_ACCESS_KEY`, `BS_APP_URL` vào GH Secrets +
 *      `.env.local` cho local sanity test. Guard throw bên dưới sẽ tự pass
 *      khi cả 3 env có giá trị non-empty.
 *   3. Upload SauceLabs-Demo-App.apk (hoặc real app build) lên BrowserStack
 *      qua REST API → nhận về `bs://...` URL → set `BS_APP_URL`.
 *   4. Thêm `'bstack:options'` capability block (projectName, buildName,
 *      sessionName, debug, networkLogs, deviceLogs).
 *   5. Override `hostname: 'hub.browserstack.com'`, `port: 443`,
 *      `path: '/wd/hub'`, `protocol: 'https'`.
 *   6. Add service: `services: ['browserstack']` (npm i @wdio/browserstack-service).
 *   7. Verify smoke E2E qua BS.
 *
 * KHÔNG dùng file này M4. Smoke E2E giữ local-dev (xem wdio.local.ts).
 *
 * Provider khác: xem `wdio.sauce.ts` cho Sauce Labs RDC stub song song.
 */
import type { Options } from '@wdio/types';
import * as path from 'node:path';
import { loadEnv } from './index';

const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

// Stub guard: throw khi chưa fill creds → fail-fast tránh boot session với
// placeholder. M5+ fill BS_* env → guard tự pass, capability `appium:app` +
// `bstack:options` block bên dưới uncomment để wire thật.
if (!env.BS_USERNAME || !env.BS_ACCESS_KEY || !env.BS_APP_URL) {
  throw new Error(
    'wdio.bs.ts STUB — yêu cầu BS_USERNAME, BS_ACCESS_KEY, BS_APP_URL trong .env.local. ' +
      'M4 (Q2 sign-off 2026-04-28): KHÔNG wire device farm — smoke E2E chạy local qua wdio.local.ts. ' +
      'Xem header file để biết M5+ activation checklist.',
  );
}

export const config: Options.Testrunner = {
  runner: 'local',

  // M5+ uncomment:
  // hostname: 'hub.browserstack.com',
  // port: 443,
  // path: '/wd/hub',
  // protocol: 'https',

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
      'appium:app': env.BS_APP_URL,
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:newCommandTimeout': 240,
      // M5+ uncomment + fill:
      // 'bstack:options': {
      //   userName: env.BS_USERNAME,
      //   accessKey: env.BS_ACCESS_KEY,
      //   projectName: 'Appium Mobile Automation',
      //   buildName: process.env.GITHUB_RUN_ID ?? 'local-dev',
      //   sessionName: 'M5+ smoke',
      //   debug: true,
      //   networkLogs: true,
      //   deviceLogs: true,
      // },
    },
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: env.DEFAULT_WAIT_TIMEOUT,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // M5+ thêm: services: ['browserstack']
  services: [],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 90_000,
    require: [
      // Quarantine FIRST — skip-before-lease tránh leak AccountPool slot.
      path.resolve(__dirname, '../../tests/_hooks/quarantine.ts'),
      path.resolve(__dirname, '../../tests/_hooks/global.ts'),
    ],
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
