/**
 * Staging config skeleton — capabilities env-driven cho BrowserStack-like
 * device farm.
 *
 * Plan ref: M3 Decision 4 (env matrix), Task 9.
 *
 * Status M3: SKELETON ONLY — không wire device farm thật. Boot test sẽ fail
 * vì BS_USERNAME/BS_ACCESS_KEY rỗng. Mục tiêu: chứng minh env loader pattern
 * + wdio config shape sẵn sàng để M4 fill in. M4 sẽ:
 *   - Validate BS_* fields require trong staging profile
 *   - Wire `services: ['browserstack']`
 *   - Override `hostname` + `port` theo BS endpoint
 *   - Upload `BS_APP_URL` reference từ BS app upload API
 */
import type { Options } from '@wdio/types';
import * as path from 'node:path';
import { loadEnv } from './index';

const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

if (env.ENV_PROFILE !== 'staging') {
  throw new Error(
    `wdio.staging.ts loaded but ENV_PROFILE=${env.ENV_PROFILE}. Set ENV_PROFILE=staging trong .env.local.`,
  );
}

if (!env.BS_USERNAME || !env.BS_ACCESS_KEY || !env.BS_APP_URL) {
  // M3 = skeleton; throw để future user biết phải fill BS creds. M4 sẽ wire.
  throw new Error(
    'Staging profile yêu cầu BS_USERNAME, BS_ACCESS_KEY, BS_APP_URL trong .env.local. ' +
      'M3 chỉ ship skeleton — M4 sẽ wire device farm thật.',
  );
}

export const config: Options.Testrunner = {
  runner: 'local',

  // Placeholder hostname/port — M4 override theo BS endpoint:
  //   hostname: 'hub.browserstack.com',
  //   port: 443,
  //   path: '/wd/hub',

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
      // M4: thêm 'bstack:options' { userName, accessKey, projectName, ... }
    },
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: env.DEFAULT_WAIT_TIMEOUT,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // M4 sẽ thêm: services: ['browserstack']
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
