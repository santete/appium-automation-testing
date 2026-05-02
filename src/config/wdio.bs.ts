/**
 * BrowserStack device farm config — M6 Task 4 ACTIVATED.
 *
 * Plan ref: M6 Decision 4 (BrowserStack chosen).
 *
 * History:
 *   - M4 (2026-04-28): STUB throw-on-load — no BS account.
 *   - M6 (2026-05-01): activated; consumes BS_USERNAME/BS_ACCESS_KEY/BS_APP_URL
 *     from .env.local (filled by Phuc).
 *
 * Cross-device matrix (5 devices Decision 4 sign-off):
 *   - Pixel 7 (Android 13)
 *   - Pixel 6 (Android 12)
 *   - Galaxy S22 (Android 12)
 *   - OnePlus 11 (Android 13)
 *   - Override per-job qua env `BS_DEVICE_FILTER` (single-device CI shard).
 *
 * Suite scope: smoke + regression. iOS spike trong wdio.bs.ios.ts (Task 8).
 *
 * Run: `npm run test:bs` (smoke), `npm run test:bs:matrix` (parallel 5 devices).
 */
import type { Options } from '@wdio/types';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { loadEnv } from './index';
import { createInfluxEmitterFromEnv } from '../utils/metrics/influxEmitter';

const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

if (!env.BS_USERNAME || !env.BS_ACCESS_KEY || !env.BS_APP_URL) {
  throw new Error(
    'wdio.bs.ts requires BS_USERNAME, BS_ACCESS_KEY, BS_APP_URL in .env.local. ' +
      'Upload your APK first: curl -u "$BS_USERNAME:$BS_ACCESS_KEY" -X POST ' +
      'https://api-cloud.browserstack.com/app-automate/upload -F "file=@./apps/SauceLabs-Demo-App.apk" ' +
      '→ copy the bs://... URL into BS_APP_URL.',
  );
}

const influxEmitter = createInfluxEmitterFromEnv(env);

function detectBranch(): string {
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  try {
    return (
      childProcess
        .execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() || 'unknown'
    );
  } catch {
    return 'unknown';
  }
}
const RUN_BRANCH = detectBranch();
const BUILD_NAME = process.env.GITHUB_RUN_ID
  ? `m6-bs-${process.env.GITHUB_RUN_ID}`
  : `m6-bs-local-${Date.now()}`;

interface BSDevice {
  deviceName: string;
  platformVersion: string;
  label: string;
}

const ALL_DEVICES: BSDevice[] = [
  { deviceName: 'Google Pixel 7', platformVersion: '13.0', label: 'pixel-7-a13' },
  { deviceName: 'Google Pixel 6', platformVersion: '12.0', label: 'pixel-6-a12' },
  { deviceName: 'Samsung Galaxy S22', platformVersion: '12.0', label: 'galaxy-s22-a12' },
  { deviceName: 'OnePlus 11R', platformVersion: '13.0', label: 'oneplus-11-a13' },
  { deviceName: 'Google Pixel 8', platformVersion: '14.0', label: 'pixel-8-a14' },
];

function selectDevices(): BSDevice[] {
  const filter = process.env.BS_DEVICE_FILTER?.trim();
  if (!filter) return ALL_DEVICES;
  const labels = filter.split(',').map((s) => s.trim());
  const matched = ALL_DEVICES.filter((d) => labels.includes(d.label));
  if (matched.length === 0) {
    throw new Error(
      `BS_DEVICE_FILTER='${filter}' didn't match any device. Available: ${ALL_DEVICES.map((d) => d.label).join(', ')}`,
    );
  }
  return matched;
}

const SELECTED = selectDevices();

const capabilities = SELECTED.map((d) => ({
  platformName: 'Android',
  'appium:deviceName': d.deviceName,
  'appium:platformVersion': d.platformVersion,
  'appium:automationName': 'UiAutomator2',
  'appium:app': env.BS_APP_URL,
  'appium:autoGrantPermissions': true,
  'appium:noReset': false,
  'appium:newCommandTimeout': 240,
  'appium:appWaitActivity': '*',
  'appium:appWaitDuration': 30000,
  'bstack:options': {
    userName: env.BS_USERNAME,
    accessKey: env.BS_ACCESS_KEY,
    projectName: 'Appium Mobile Automation',
    buildName: BUILD_NAME,
    sessionName: `m6-${d.label}`,
    debug: true,
    networkLogs: true,
    deviceLogs: true,
  },
}));

export const config: Options.Testrunner = {
  runner: 'local',
  hostname: 'hub.browserstack.com',
  port: 443,
  path: '/wd/hub',
  protocol: 'https',
  user: env.BS_USERNAME,
  key: env.BS_ACCESS_KEY,

  specs: ['../../tests/**/*.spec.ts'],
  suites: {
    smoke: ['../../tests/smoke/**/*.spec.ts'],
    regression: ['../../tests/regression/**/*.spec.ts'],
    perf: ['../../tests/perf/**/*.spec.ts'],
    visual: ['../../tests/visual/**/*.spec.ts'],
  },

  maxInstances: SELECTED.length,
  capabilities,

  logLevel: 'info',
  bail: 0,
  waitforTimeout: env.DEFAULT_WAIT_TIMEOUT,
  connectionRetryTimeout: 240000,
  connectionRetryCount: 3,

  services: [
    [
      'browserstack',
      {
        browserstackLocal: false,
        opts: { forcelocal: false },
      },
    ],
  ],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
    require: [
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
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  afterTest: async function (test, _context, { error, duration, passed }) {
    try {
      const allureReporter = (await import('@wdio/allure-reporter')).default;
      if (error) {
        const screenshot = await browser.takeScreenshot();
        allureReporter.addAttachment(
          `Failure screenshot — ${test.title}`,
          Buffer.from(screenshot, 'base64'),
          'image/png',
        );
      }
      // Detect device label from current capabilities (browser.capabilities populated at runtime).
      const caps =
        (browser as unknown as { capabilities?: Record<string, unknown> }).capabilities ?? {};
      const deviceTag =
        ((caps as { 'appium:deviceName'?: string })['appium:deviceName'] ?? 'unknown') +
        '@' +
        ((caps as { 'appium:platformVersion'?: string })['appium:platformVersion'] ?? 'unknown');
      await influxEmitter.emitTestRun({
        testId: test.title,
        suite: test.parent ?? 'unknown',
        env: 'browserstack',
        device: deviceTag,
        branch: RUN_BRANCH,
        durationMs: duration,
        status: passed ? 'pass' : 'fail',
      });
    } catch (hookErr) {
      console.error('afterTest hook failed:', hookErr);
    }
  },
};
