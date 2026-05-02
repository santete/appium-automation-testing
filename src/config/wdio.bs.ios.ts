/**
 * iOS spike — BrowserStack iPhone 14 simulator (M6 Task 8 / Decision 9).
 *
 * Scope: 1 spec (`tests/smoke/login-ios.spike.ts`). NOT regression coverage.
 *
 * Env: BS_USERNAME, BS_ACCESS_KEY, BS_IOS_APP_URL (separate iOS .ipa upload —
 * Phuc upload SauceLabs-Demo-App.ipa lên BS App Automate trước run).
 *
 * Run: `npx wdio run ./src/config/wdio.bs.ios.ts`
 */
import type { Options } from '@wdio/types';
import * as path from 'node:path';
import { loadEnv } from './index';

const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

if (!env.BS_USERNAME || !env.BS_ACCESS_KEY || !env.BS_IOS_APP_URL) {
  throw new Error(
    'wdio.bs.ios.ts requires BS_USERNAME, BS_ACCESS_KEY, BS_IOS_APP_URL in .env.local. ' +
      'Upload .ipa first: curl -u "$BS_USERNAME:$BS_ACCESS_KEY" -X POST ' +
      'https://api-cloud.browserstack.com/app-automate/upload -F "file=@./apps/SauceLabs-Demo-App.ipa" ' +
      '→ copy bs://... URL into BS_IOS_APP_URL.',
  );
}

export const config: Options.Testrunner = {
  runner: 'local',
  hostname: 'hub.browserstack.com',
  port: 443,
  path: '/wd/hub',
  protocol: 'https',
  user: env.BS_USERNAME,
  key: env.BS_ACCESS_KEY,

  specs: ['../../tests/smoke/login-ios.spike.ts'],

  maxInstances: 1,
  capabilities: [
    {
      platformName: 'iOS',
      'appium:deviceName': 'iPhone 14',
      'appium:platformVersion': '17',
      'appium:automationName': 'XCUITest',
      'appium:app': env.BS_IOS_APP_URL,
      'appium:autoAcceptAlerts': true,
      'appium:newCommandTimeout': 240,
      'bstack:options': {
        userName: env.BS_USERNAME,
        accessKey: env.BS_ACCESS_KEY,
        projectName: 'Appium Mobile Automation',
        buildName: `m6-ios-spike-${process.env.GITHUB_RUN_ID ?? Date.now()}`,
        sessionName: 'm6-ios-spike-login',
        debug: true,
        deviceLogs: true,
      },
    },
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: env.DEFAULT_WAIT_TIMEOUT,
  connectionRetryTimeout: 240000,
  connectionRetryCount: 3,

  services: [['browserstack', { browserstackLocal: false, opts: { forcelocal: false } }]],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
  },

  reporters: ['spec'],
};
