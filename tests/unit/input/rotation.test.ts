import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE, WORLD_SIZE } from '../../../src/core/types';
import {
  BIG_ORBIT_LIMITS,
  DEFAULT_ORBIT,
  galleryOrbitFor,
  GALLERY_ORBIT,
  isBigWorld,
  ORBIT_LIMITS,
  orbitLimitsFor,
  orbitToPosition,
  panTarget,
  rotationFromYaw,
  zoomBy,
} from '../../../src/input/orbit';

const Q = Math.PI / 2;

describe('rotationFromYaw', () => {
  it('points the part away from the camera', () => {
    // Camera south of the target (azimuth 0) looks north: rotation 0 (forward = north).
    expect(rotationFromYaw(0)).toBe(0);
    expect(rotationFromYaw(Q)).toBe(3); // Camera east, looking west.
    expect(rotationFromYaw(Math.PI)).toBe(2); // Looking south.
    expect(rotationFromYaw(-Q)).toBe(1); // Camera west, looking east.
  });

  it('snaps to the nearest quarter turn and wraps any angle', () => {
    expect(rotationFromYaw(0.7)).toBe(0);
    expect(rotationFromYaw(0.9)).toBe(3);
    expect(rotationFromYaw(Math.PI * 2 + Q)).toBe(3);
    expect(rotationFromYaw(-Math.PI * 6)).toBe(0);
    expect(rotationFromYaw(Number.NaN)).toBe(0);
  });

  it('agrees with where the camera actually is', () => {
    for (let a = -7; a < 7; a += 0.37) {
      const [cx, , cz] = orbitToPosition({ ...DEFAULT_ORBIT, azimuth: a }, { x: 0, y: 0, z: 0 });
      // View direction on the ground is from the camera toward the target.
      const forward = [[0, -1], [1, 0], [0, 1], [-1, 0]][rotationFromYaw(a)];
      expect(forward[0] * -cx + forward[1] * -cz).toBeGreaterThan(0);
    }
  });
});

describe('world-size aware orbit', () => {
  it('uses the little limits for the island and wider ones for big worlds', () => {
    expect(isBigWorld(WORLD_SIZE)).toBe(false);
    expect(isBigWorld(BIG_WORLD_SIZE)).toBe(true);
    expect(orbitLimitsFor(WORLD_SIZE)).toBe(ORBIT_LIMITS);
    expect(zoomBy(DEFAULT_ORBIT, 0.001, orbitLimitsFor(BIG_WORLD_SIZE)).radius).toBe(BIG_ORBIT_LIMITS.minRadius);
    expect(galleryOrbitFor(WORLD_SIZE)).toBe(GALLERY_ORBIT);
    expect(galleryOrbitFor(BIG_WORLD_SIZE).radius).toBeGreaterThan(GALLERY_ORBIT.radius);
  });

  it('pans the target with the fingers and clamps it to the world', () => {
    const bounds = { minX: 0, maxX: 96, minZ: 0, maxZ: 96 };
    const s = { azimuth: 0, polar: 1, radius: 30 };
    // Camera south looking north: fingers right moves the world right, so the target goes west.
    const right = panTarget({ x: 48, z: 48 }, s, 100, 0, 700, bounds);
    expect(right.x).toBeLessThan(48);
    expect(right.z).toBeCloseTo(48);
    // Fingers down pull the world closer: the target moves north (away from the camera).
    const down = panTarget({ x: 48, z: 48 }, s, 0, 100, 700, bounds);
    expect(down.z).toBeLessThan(48);
    expect(panTarget({ x: 1, z: 1 }, s, 10000, -10000, 700, bounds)).toEqual({ x: 0, z: 96 });
  });
});
