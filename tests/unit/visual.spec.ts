/**
 * Unit tests cho visual regression utilities (M6 Task 2).
 *
 * Cover:
 *  - compareImage: identical buffers → 0% mismatch → withinThreshold true.
 *  - compareImage: different buffers → mismatch > 0; nếu > threshold →
 *    diffBuffer non-empty.
 *  - compareImage: dimension mismatch + failOnDimensionMismatch → 100%.
 *  - BaselineStore: read/write baselines + actual + diff to temp dir.
 *  - isUpdateMode: env truthy/falsy detection.
 *  - visualAssert update mode: writes baseline, returns 'updated'.
 *  - visualAssert compare mode hit/miss baseline → throw if missing,
 *    PASS if within threshold, throw with diff if exceed.
 */
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PNG } from 'pngjs';
import { compareImage } from '../../src/utils/visual/compareImage';
import { BaselineStore, isUpdateMode } from '../../src/utils/visual/baselineStore';
import { visualAssert } from '../../src/utils/visual/visualAssert';

function makePng(width: number, height: number, fill: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) * 4;
      png.data[idx] = fill[0];
      png.data[idx + 1] = fill[1];
      png.data[idx + 2] = fill[2];
      png.data[idx + 3] = fill[3];
    }
  }
  return PNG.sync.write(png);
}

function tmpStore(): BaselineStore {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-test-'));
  return new BaselineStore({
    baselinesDir: path.join(root, 'baselines'),
    actualDir: path.join(root, 'actual'),
    diffDir: path.join(root, 'diff'),
  });
}

describe('compareImage', () => {
  it('identical buffers → 0% mismatch + withinThreshold true', async () => {
    const buf = makePng(20, 20, [255, 0, 0, 255]);
    const result = await compareImage(buf, buf, { mismatchThresholdPct: 0.5 });
    expect(result.mismatchPct).to.equal(0);
    expect(result.withinThreshold).to.equal(true);
    expect(result.baselineWidth).to.equal(20);
  });

  it('different buffers → mismatch > 0', async () => {
    const a = makePng(20, 20, [255, 0, 0, 255]);
    const b = makePng(20, 20, [0, 255, 0, 255]);
    const result = await compareImage(a, b, { mismatchThresholdPct: 0.5 });
    expect(result.mismatchPct).to.be.greaterThan(0);
    expect(result.withinThreshold).to.equal(false);
    expect(result.diffBuffer.length).to.be.greaterThan(0);
  });

  it('dimension mismatch + failOnDimensionMismatch=true → 100%', async () => {
    const a = makePng(20, 20, [255, 0, 0, 255]);
    const b = makePng(40, 40, [255, 0, 0, 255]);
    const result = await compareImage(a, b);
    expect(result.mismatchPct).to.equal(100);
    expect(result.withinThreshold).to.equal(false);
  });
});

describe('BaselineStore', () => {
  it('writes/reads baseline + actual + diff to configured dirs', () => {
    const store = tmpStore();
    const png = makePng(10, 10, [0, 0, 255, 255]);
    expect(store.hasBaseline('home')).to.equal(false);
    store.writeBaseline('home', png);
    expect(store.hasBaseline('home')).to.equal(true);
    expect(store.readBaseline('home').length).to.equal(png.length);

    store.writeActual('home', png);
    store.writeDiff('home', png);
    expect(fs.existsSync(store.actualPath('home'))).to.equal(true);
    expect(fs.existsSync(store.diffPath('home'))).to.equal(true);
  });
});

describe('isUpdateMode', () => {
  it('detects truthy env values', () => {
    expect(isUpdateMode({ VISUAL_UPDATE_BASELINES: '1' } as NodeJS.ProcessEnv)).to.equal(true);
    expect(isUpdateMode({ VISUAL_UPDATE_BASELINES: 'true' } as NodeJS.ProcessEnv)).to.equal(true);
  });
  it('falsy / unset → false', () => {
    expect(isUpdateMode({} as NodeJS.ProcessEnv)).to.equal(false);
    expect(isUpdateMode({ VISUAL_UPDATE_BASELINES: '0' } as NodeJS.ProcessEnv)).to.equal(false);
    expect(isUpdateMode({ VISUAL_UPDATE_BASELINES: 'no' } as NodeJS.ProcessEnv)).to.equal(false);
  });
});

describe('visualAssert', () => {
  function makeDriver(b64: string) {
    return { takeScreenshot: async () => b64 };
  }
  function attacherStub() {
    const calls: Array<{ name: string; mime: string; len: number }> = [];
    return {
      attach: (name: string, content: Buffer | string, mime: string) =>
        calls.push({
          name,
          mime,
          len: typeof content === 'string' ? content.length : content.length,
        }),
      calls,
    };
  }

  it('update mode: writes baseline + returns mode=updated', async () => {
    const store = tmpStore();
    const png = makePng(10, 10, [10, 20, 30, 255]);
    const driver = makeDriver(png.toString('base64'));
    const result = await visualAssert(driver, 'home', { store, updateMode: true });
    expect(result.mode).to.equal('updated');
    expect(store.hasBaseline('home')).to.equal(true);
  });

  it('compare mode + missing baseline → throws actionable error', async () => {
    const store = tmpStore();
    const png = makePng(10, 10, [10, 20, 30, 255]);
    const driver = makeDriver(png.toString('base64'));
    let threw: Error | null = null;
    try {
      await visualAssert(driver, 'home', { store, updateMode: false });
    } catch (e) {
      threw = e as Error;
    }
    expect(threw).to.not.equal(null);
    expect(threw!.message).to.match(/baseline missing/);
    expect(threw!.message).to.match(/VISUAL_UPDATE_BASELINES=1/);
  });

  it('compare mode + identical baseline → returns mode=compared withinThreshold', async () => {
    const store = tmpStore();
    const png = makePng(10, 10, [10, 20, 30, 255]);
    store.writeBaseline('home', png);
    const driver = makeDriver(png.toString('base64'));
    const attacher = attacherStub();
    const result = await visualAssert(driver, 'home', {
      store,
      updateMode: false,
      allure: attacher,
    });
    expect(result.mode).to.equal('compared');
    expect(result.comparison?.withinThreshold).to.equal(true);
    const names = attacher.calls.map((c) => c.name);
    expect(names).to.include('actual-home.png');
    expect(names).to.include('baseline-home.png');
  });

  it('compare mode + mismatch over threshold → throws + writes diff', async () => {
    const store = tmpStore();
    const baseline = makePng(20, 20, [255, 0, 0, 255]);
    const actual = makePng(20, 20, [0, 255, 0, 255]);
    store.writeBaseline('home', baseline);
    const driver = makeDriver(actual.toString('base64'));
    let threw: Error | null = null;
    try {
      await visualAssert(driver, 'home', {
        store,
        updateMode: false,
        mismatchThresholdPct: 0.1,
      });
    } catch (e) {
      threw = e as Error;
    }
    expect(threw).to.not.equal(null);
    expect(threw!.message).to.match(/mismatch/);
    expect(fs.existsSync(store.diffPath('home'))).to.equal(true);
  });
});
