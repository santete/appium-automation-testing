/**
 * Unit test — mobile:executeScript backend cho StateChecker.
 *
 * Plan ref: M3 Task 19, D4 repay.
 *
 * Mock driver chỉ implement `execute(script, args)` — verify adapter dispatch
 * đúng `mobile: shell` command + args, parse XML, route lookup chính xác. KHÔNG
 * cần Appium runtime.
 */
import { expect } from 'chai';
import { StateChecker } from '../../src/utils/assertion/checkers/StateChecker';
import {
  createMobileExecuteScriptStateCheckerDeps,
  NotImplementedError,
  type MobileExecuteScriptDriver,
} from '../../src/utils/assertion/checkers/mobileExecuteScriptStateCheckerDeps';

interface ShellCall {
  command: string;
  args: string[];
}

function makeDriver(handlers: {
  ls?: (pkg: string) => string;
  cat?: (pkg: string, file: string) => string | { stdout: string };
  catThrows?: Set<string>;
}): { driver: MobileExecuteScriptDriver; calls: ShellCall[] } {
  const calls: ShellCall[] = [];
  const driver: MobileExecuteScriptDriver = {
    async execute(script, args) {
      expect(script).to.equal('mobile: shell');
      const command = args.command as string;
      const shellArgs = args.args as string[];
      calls.push({ command, args: shellArgs });

      const [pkg, op, target] = shellArgs;
      if (op === 'ls') {
        return handlers.ls ? handlers.ls(pkg) : '';
      }
      if (op === 'cat') {
        const file = target.split('/').pop() ?? '';
        if (handlers.catThrows?.has(file)) {
          throw new Error(`run-as cat ${file} denied`);
        }
        return handlers.cat ? handlers.cat(pkg, file) : '';
      }
      return '';
    },
  };
  return { driver, calls };
}

describe('mobileExecuteScriptStateCheckerDeps', () => {
  const PKG = 'com.swaglabsmobileapp';

  it('lease shared_prefs key qua mobile: shell run-as ls + cat', async () => {
    const xml =
      '<?xml version="1.0"?>\n<map>\n  <string name="auth_token">tok-xyz</string>\n</map>\n';
    const { driver, calls } = makeDriver({
      ls: () => 'auth.xml\nsettings.xml\n',
      cat: (_, file) => (file === 'auth.xml' ? xml : ''),
    });
    const checker = new StateChecker(createMobileExecuteScriptStateCheckerDeps(driver));

    const out = await checker.run({
      id: 'state.token',
      type: 'state_property',
      severity: 'high',
      source: 'shared_prefs',
      package: PKG,
      key: 'auth_token',
      expect: { equals: 'tok-xyz' },
    });

    expect(out.passed).to.equal(true);
    expect(calls).to.have.lengthOf(2);
    expect(calls[0].command).to.equal('run-as');
    expect(calls[0].args).to.deep.equal([PKG, 'ls', `/data/data/${PKG}/shared_prefs/`]);
    expect(calls[1].args).to.deep.equal([PKG, 'cat', `/data/data/${PKG}/shared_prefs/auth.xml`]);
  });

  it('handles `{ stdout }` shape từ driver wrap', async () => {
    const xml = '<map><boolean name="logged_in" value="true"/></map>';
    const { driver } = makeDriver({
      ls: () => 'state.xml',
      cat: () => ({ stdout: xml }),
    });
    const checker = new StateChecker(createMobileExecuteScriptStateCheckerDeps(driver));

    const out = await checker.run({
      id: 'state.li',
      type: 'state_property',
      severity: 'medium',
      source: 'shared_prefs',
      package: PKG,
      key: 'logged_in',
      expect: { equals: 'true' },
    });
    expect(out.passed).to.equal(true);
  });

  it('skip file nếu cat throw, tiếp tục file kế', async () => {
    const xml = '<map><string name="user_id">42</string></map>';
    const { driver } = makeDriver({
      ls: () => 'protected.xml\nuser.xml',
      cat: (_, file) => (file === 'user.xml' ? xml : ''),
      catThrows: new Set(['protected.xml']),
    });
    const checker = new StateChecker(createMobileExecuteScriptStateCheckerDeps(driver));

    const out = await checker.run({
      id: 'state.uid',
      type: 'state_property',
      severity: 'medium',
      source: 'shared_prefs',
      package: PKG,
      key: 'user_id',
      expect: { regex: '^\\d+$' },
    });
    expect(out.passed).to.equal(true);
  });

  it('return null khi key không tồn tại trong bất kỳ XML nào', async () => {
    const { driver } = makeDriver({
      ls: () => 'a.xml\nb.xml',
      cat: () => '<map></map>',
    });
    const checker = new StateChecker(createMobileExecuteScriptStateCheckerDeps(driver));

    const out = await checker.run({
      id: 'state.missing',
      type: 'state_property',
      severity: 'high',
      source: 'shared_prefs',
      package: PKG,
      key: 'absent_key',
      expect: { not_null: true },
    });
    expect(out.passed).to.equal(false);
    expect(out.message).to.contain('expected not_null');
  });

  it('throw NotImplementedError cho source != shared_prefs', async () => {
    const { driver } = makeDriver({});
    const deps = createMobileExecuteScriptStateCheckerDeps(driver);
    let err: Error | undefined;
    try {
      await deps.getValue({ source: 'sqlite', package: PKG, key: 'foo' });
    } catch (e) {
      err = e as Error;
    }
    expect(err).to.be.instanceOf(NotImplementedError);
    expect(err?.message).to.contain('sqlite');
  });

  it('reject malformed package name (injection guard)', async () => {
    const { driver } = makeDriver({});
    const deps = createMobileExecuteScriptStateCheckerDeps(driver);
    let err: Error | undefined;
    try {
      await deps.getValue({
        source: 'shared_prefs',
        package: 'com.app; rm -rf /',
        key: 'k',
      });
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message).to.contain('invalid Android package name');
  });
});
