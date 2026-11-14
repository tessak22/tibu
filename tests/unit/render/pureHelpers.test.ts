import { describe, expect, it } from 'vitest';
import { capacity, sizeFor, slotPixel, slotUv, SLOT, GUTTER } from '../../../src/render/atlasLayout';
import { QualityMonitor } from '../../../src/render/quality';
import { buildUnderside, columnDepths } from '../../../src/render/scene/undersideGeometry';
import { islandMask } from '../../../src/world/island';

describe('atlas layout', () => {
  it('grows through power-of-two sizes', () => {
    expect(sizeFor(1)).toBe(1024);
    expect(sizeFor(capacity(1024) + 1)).toBe(2048);
    expect(sizeFor(capacity(4096) + 1)).toBeNull();
  });

  it('keeps tiles inside their gutters and UVs inside [0,1]', () => {
    const p = slotPixel(8, 1024);
    expect(p.x % SLOT).toBe(GUTTER);
    const [u0, v0, u1, v1] = slotUv(8, 1024);
    for (const v of [u0, v0, u1, v1]) expect(v).toBeGreaterThanOrEqual(0);
    expect(u1).toBeGreaterThan(u0);
    expect(v1).toBeGreaterThan(v0);
    expect(Math.max(u1, v1)).toBeLessThanOrEqual(1);
  });
});

describe('QualityMonitor', () => {
  it('switches to low quality after sustained low FPS, once', () => {
    const q = new QualityMonitor({ warmupSeconds: 0, windowSeconds: 3, lowFps: 40 });
    let switched = 0;
    for (let i = 0; i < 25 * 5; i++) if (q.frame(1 / 25)) switched++;
    expect(q.isLow()).toBe(true);
    expect(switched).toBe(1);
  });

  it('stays high at 60 fps and ignores long pauses', () => {
    const q = new QualityMonitor({ warmupSeconds: 0 });
    for (let i = 0; i < 600; i++) q.frame(1 / 60);
    for (let i = 0; i < 20; i++) q.frame(2);
    expect(q.isLow()).toBe(false);
  });
});

describe('island underside', () => {
  it('is deepest near the middle and only under ground columns', () => {
    const mask = islandMask('round');
    const depths = columnDepths(mask, 6);
    expect(depths[0]).toBe(0);
    expect(depths[12 + 12 * 24]).toBeGreaterThan(depths[12 + 1 * 24]);
    expect(Math.max(...depths)).toBeLessThanOrEqual(8);
  });

  it('builds non-empty, consistent arrays', () => {
    const arrays = buildUnderside(islandMask('blob'), 5);
    expect(arrays.indices.length).toBeGreaterThan(0);
    expect(arrays.positions.length).toBe(arrays.normals.length);
    expect(arrays.positions.length).toBe(arrays.colors.length);
    for (let i = 1; i < arrays.positions.length; i += 3) expect(arrays.positions[i]).toBeLessThanOrEqual(0);
  });
});
