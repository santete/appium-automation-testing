import type { Options } from '@wdio/types';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { loadEnv } from './index';
import { createInfluxEmitterFromEnv } from '../utils/metrics/influxEmitter';

const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

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

export const config: Options.Testrunner = {
  runner: 'local',

  specs: ['../../tests/**/*.spec.ts'],
  suites: {
    smoke: ['../../tests/smoke/**/*.spec.ts'],
    regression: ['../../tests/regression/**/*.spec.ts'],
    negative: ['../../tests/negative/**/*.spec.ts'],
    nightly: ['../../tests/nightly/**/*.spec.ts'],
    perf: ['../../tests/perf/**/*.spec.ts'],
    visual: ['../../tests/visual/**/*.spec.ts'],
  },

  maxInstances: 1,

  capabilities: [
    {
      platformName: 'Android',
      'appium:deviceName': env.ANDROID_DEVICE_NAME,
      'appium:platformVersion': env.ANDROID_PLATFORM_VERSION,
      'appium:automationName': 'UiAutomator2',
      'appium:app': path.resolve(__dirname, '../..', env.APP_PATH),
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:newCommandTimeout': 240,
      'appium:appWaitActivity': '*',
      'appium:appWaitDuration': 30000,
    },
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: env.DEFAULT_WAIT_TIMEOUT,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  services: [
    [
      'appium',
      {
        args: { relaxedSecurity: true },
        logPath: './reports/appium-logs',
      },
    ],
  ],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
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
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
        useCucumberStepReporter: false,
      },
    ],
  ],

  /**
   * Hook on-fail bắt buộc (spec §3 step 5) + M5 Task 6 metric emit:
   *   - Screenshot on failure attached vào Allure
   *   - Page source dump cho debug locator
   *   - Emit test_run datapoint vào InfluxDB (best-effort, không throw)
   */
  afterTest: async function (test, _context, { error, duration, passed }) {
    if (error) {
      try {
        const screenshot = await browser.takeScreenshot();
        const allureReporter = (await import('@wdio/allure-reporter')).default;
        allureReporter.addAttachment(
          `Failure screenshot — ${test.title}`,
          Buffer.from(screenshot, 'base64'),
          'image/png',
        );

        const pageSource = await browser.getPageSource();
        allureReporter.addAttachment(`Page source — ${test.title}`, pageSource, 'application/xml');
      } catch (hookErr) {
        console.error('afterTest hook failed:', hookErr);
      }
    }

    if (influxEmitter.isEnabled()) {
      const suite =
        (test.parent as string | undefined) ??
        (test.file ? path.basename(test.file, '.spec.ts') : 'unknown');
      await influxEmitter.emitTestRun({
        testId: test.title,
        suite,
        env: env.ENV_PROFILE,
        device: env.ANDROID_DEVICE_NAME,
        branch: RUN_BRANCH,
        durationMs: duration ?? 0,
        status: passed ? 'pass' : 'fail',
      });
    }
  },
};
