import { describe, expect, it } from 'vitest';
import { DEFAULT_ORBIT, ORBIT_LIMITS, lerpOrbit, orbitByDrag, orbitToPosition, zoomBy } from '../../../src/input/orbit';

describe('orbit math', () => {
  it('clamps polar so the camera never goes underground or flips', () => {
    const down = orbitByDrag(DEFAULT_ORBIT, 0, -100000, 700);
    expect(down.polar).toBe(ORBIT_LIMITS.maxPolar);
    const up = orbitByDrag(DEFAULT_ORBIT, 0, 100000, 700);
    expect(up.polar).toBe(ORBIT_LIMITS.minPolar);
    const [, y] = orbitToPosition(down, { x: 12, y: 2, z: 12 });
    expect(y).toBeGreaterThan(2);
  });

  it('clamps zoom', () => {
    expect(zoomBy(DEFAULT_ORBIT, 100).radius).toBe(ORBIT_LIMITS.maxRadius);
    expect(zoomBy(DEFAULT_ORBIT, 0.001).radius).toBe(ORBIT_LIMITS.minRadius);
    expect(zoomBy(DEFAULT_ORBIT, NaN)).toBe(DEFAULT_ORBIT);
  });

  it('does not mutate input state', () => {
    const before = { ...DEFAULT_ORBIT };
    orbitByDrag(DEFAULT_ORBIT, 50, 50, 700);
    expect(DEFAULT_ORBIT).toEqual(before);
  });

  it('interpolates azimuth along the shortest path', () => {
    const a = { ...DEFAULT_ORBIT, azimuth: 0.1 };
    const b = { ...DEFAULT_ORBIT, azimuth: Math.PI * 2 - 0.1 };
    expect(lerpOrbit(a, b, 0.5).azimuth).toBeCloseTo(0);
  });
});
