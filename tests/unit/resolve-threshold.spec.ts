/**
 * Unit tests for `resolvePerfThreshold` — D7 closure (M7 hand-off).
 *
 * Cover:
 *   - env override parsed + returned with `source=env_override`
 *   - missing/empty env → contract default
 *   - invalid env value → throw
 *   - emulator detection patterns + PERF_FORCE_DEVICE_TYPE override
 *   - calibration warning emitted only when emulator + no override
 *   - resolvePerfThresholdByCheckId selects correct check
 */
import { expect } from 'chai';
import {
  resolvePerfThreshold,
  resolvePerfThresholdByCheckId,
  isEmulator,
} from '../../src/utils/perf/resolveThreshold';

describe('resolvePerfThreshold — env override', () => {
  it('uses env override when set', () => {
    const result = resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: { PERF_LOGIN_SLA_MS: '5000' },
      log: () => {},
    });
    expect(result.thresholdMs).to.equal(5000);
    expect(result.source).to.equal('env_override');
    expect(result.envVar).to.equal('PERF_LOGIN_SLA_MS');
    expect(result.envValue).to.equal('5000');
  });

  it('falls back to contract default when env unset', () => {
    const result = resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: {},
      log: () => {},
    });
    expect(result.thresholdMs).to.equal(2000);
    expect(result.source).to.equal('contract_default');
    expect(result.envVar).to.equal('PERF_LOGIN_SLA_MS');
  });

  it('treats empty env as unset', () => {
    const result = resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: { PERF_LOGIN_SLA_MS: '' },
      log: () => {},
    });
    expect(result.source).to.equal('contract_default');
  });

  it('rounds non-integer env value', () => {
    const result = resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: { PERF_LOGIN_SLA_MS: '5500.7' },
      log: () => {},
    });
    expect(result.thresholdMs).to.equal(5501);
  });

  it('throws on invalid env value', () => {
    expect(() =>
      resolvePerfThreshold('AC_PERF_LOGIN_001', {
        env: { PERF_LOGIN_SLA_MS: 'fast' },
        log: () => {},
      }),
    ).to.throw(/PERF_LOGIN_SLA_MS.*not a positive integer/);
  });

  it('throws on zero or negative env value', () => {
    expect(() =>
      resolvePerfThreshold('AC_PERF_LOGIN_001', {
        env: { PERF_LOGIN_SLA_MS: '0' },
        log: () => {},
      }),
    ).to.throw(/positive integer/);
    expect(() =>
      resolvePerfThreshold('AC_PERF_LOGIN_001', {
        env: { PERF_LOGIN_SLA_MS: '-100' },
        log: () => {},
      }),
    ).to.throw(/positive integer/);
  });
});

describe('resolvePerfThreshold — emulator calibration warning', () => {
  it('warns when emulator detected and override missing', () => {
    const calls: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
    resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: { ANDROID_DEVICE_NAME: 'emulator-5554' },
      log: (msg, meta) => calls.push({ msg, meta }),
    });
    expect(calls).to.have.length(1);
    expect(calls[0].msg).to.match(/looks like an emulator/);
    expect(calls[0].meta?.envVar).to.equal('PERF_LOGIN_SLA_MS');
  });

  it('does not warn when env override is set', () => {
    const calls: unknown[] = [];
    resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: {
        ANDROID_DEVICE_NAME: 'emulator-5554',
        PERF_LOGIN_SLA_MS: '5000',
      },
      log: () => calls.push(1),
    });
    expect(calls).to.have.length(0);
  });

  it('does not warn on real device', () => {
    const calls: unknown[] = [];
    resolvePerfThreshold('AC_PERF_LOGIN_001', {
      env: { ANDROID_DEVICE_NAME: 'Pixel-6-USB' },
      log: () => calls.push(1),
    });
    expect(calls).to.have.length(0);
  });
});

describe('isEmulator detection', () => {
  it('matches `emulator-XXXX`', () => {
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'emulator-5554' })).to.be.true;
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'emulator-1' })).to.be.true;
  });

  it('matches AVD default name pattern', () => {
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'Pixel_6_API_34' })).to.be.true;
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'AVD_Galaxy' })).to.be.true;
  });

  it('matches simulator suffix', () => {
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'iPhone_15_Simulator' })).to.be.true;
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'ios_simulator' })).to.be.true;
  });

  it('does not match real device names', () => {
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'Pixel-6-USB' })).to.be.false;
    expect(isEmulator({ ANDROID_DEVICE_NAME: 'Samsung-A14' })).to.be.false;
    expect(isEmulator({})).to.be.false;
  });

  it('respects PERF_FORCE_DEVICE_TYPE=real', () => {
    expect(
      isEmulator({
        ANDROID_DEVICE_NAME: 'emulator-5554',
        PERF_FORCE_DEVICE_TYPE: 'real',
      }),
    ).to.be.false;
  });

  it('respects PERF_FORCE_DEVICE_TYPE=emulator', () => {
    expect(
      isEmulator({
        ANDROID_DEVICE_NAME: 'Pixel-6-USB',
        PERF_FORCE_DEVICE_TYPE: 'emulator',
      }),
    ).to.be.true;
  });
});

describe('resolvePerfThresholdByCheckId', () => {
  it('selects perf check by id', () => {
    const result = resolvePerfThresholdByCheckId('AC_PERF_LOGIN_001', 'perf.login_p95_under_2s', {
      env: {},
      log: () => {},
    });
    expect(result.thresholdMs).to.equal(2000);
    expect(result.envVar).to.equal('PERF_LOGIN_SLA_MS');
  });

  it('throws when check id not found', () => {
    expect(() =>
      resolvePerfThresholdByCheckId('AC_PERF_LOGIN_001', 'perf.nope', {
        env: {},
        log: () => {},
      }),
    ).to.throw(/no perf check id="perf.nope"/);
  });
});
