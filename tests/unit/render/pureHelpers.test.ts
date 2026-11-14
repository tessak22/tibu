import { describe, expect, it } from 'vitest';
import { capacity, sizeFor, slotPixel, slotUv, SLOT, GUTTER } from '../../../src/render/atlasLayout';
import { QualityMonitor } from '../../../src/render/quality';
import { buildUnderside, columnDepths } from '../../../src/render/scene/undersideGeometry';

/** A round 24x24 island mask (independent of the world module). */
function roundMask(size = 24): Uint8Array {
  const mask = new Uint8Array(size * size);
  const c = (size - 1) / 2;
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) mask[x + z * size] = Math.hypot(x - c, z - c) <= size / 2 - 0.3 ? 1 : 0;
  return mask;
}

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
    const mask = roundMask();
    const depths = columnDepths(mask, 6);
    expect(depths[0]).toBe(0);
    expect(depths[12 + 12 * 24]).toBeGreaterThan(depths[12 + 1 * 24]);
    expect(Math.max(...depths)).toBeLessThanOrEqual(8);
  });

  it('builds non-empty, consistent arrays', () => {
    const arrays = buildUnderside(roundMask(), 5);
    expect(arrays.indices.length).toBeGreaterThan(0);
    expect(arrays.positions.length).toBe(arrays.normals.length);
    expect(arrays.positions.length).toBe(arrays.colors.length);
    for (let i = 1; i < arrays.positions.length; i += 3) expect(arrays.positions[i]).toBeLessThanOrEqual(0);
  });

  it('handles big worlds with several islands', () => {
    const size = { x: 96, z: 96 };
    const mask = new Uint8Array(96 * 96);
    for (const [cx, cz] of [[20, 20], [70, 60]]) {
      for (let z = 0; z < 96; z++) for (let x = 0; x < 96; x++) if (Math.hypot(x - cx, z - cz) < 12) mask[x + z * 96] = 1;
    }
    const depths = columnDepths(mask, 6, size);
    expect(depths[20 + 20 * 96]).toBeGreaterThan(depths[9 + 20 * 96]);
    expect(depths[45 + 45 * 96]).toBe(0);
    const arrays = buildUnderside(mask, 6, size);
    expect(arrays.positions.length).toBeGreaterThan(0);
  });
});
