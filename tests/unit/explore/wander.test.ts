import { describe, expect, it } from 'vitest';
import { createRng } from '../../../src/explore/rng';
import { clampRoute, pickWanderTarget, restTime } from '../../../src/explore/wander';
import * as walk from '../../../src/world/walk';
import { fakeWorld, floor } from './fakeWorld';

describe('pickWanderTarget', () => {
  it('always stays within the home radius and on standable cells', () => {
    const w = fakeWorld(20, 8, 20);
    floor(w);
    const rng = createRng(42);
    const home = { x: 10, y: 1, z: 10 };
    for (let i = 0; i < 300; i++) {
      const t = pickWanderTarget(rng, home, 3, (c) => walk.standable(w, c));
      expect(t).not.toBeNull();
      expect(Math.abs(t!.x - home.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(t!.z - home.z)).toBeLessThanOrEqual(3);
      expect(walk.standable(w, t!)).toBe(true);
    }
  });

  it('returns null (keep resting) when nothing nearby is walkable', () => {
    const w = fakeWorld();
    expect(pickWanderTarget(createRng(1), { x: 5, y: 1, z: 5 }, 2, (c) => walk.standable(w, c))).toBeNull();
  });

  it('is deterministic for a seed', () => {
    const w = fakeWorld(20, 8, 20);
    floor(w);
    const ok = (c: { x: number; y: number; z: number }) => walk.standable(w, c);
    const a = pickWanderTarget(createRng(7), { x: 10, y: 1, z: 10 }, 4, ok);
    const b = pickWanderTarget(createRng(7), { x: 10, y: 1, z: 10 }, 4, ok);
    expect(a).toEqual(b);
  });
});

describe('clampRoute', () => {
  it('cuts the route at the first cell outside the range', () => {
    const home = { x: 0, y: 1, z: 0 };
    const steps = [1, 2, 3, 4, 5].map((x) => ({ x, y: 1, z: 0 }));
    expect(clampRoute(steps, home, 3).map((s) => s.x)).toEqual([1, 2, 3]);
  });
});

describe('restTime', () => {
  it('rests between 2 and 10 seconds', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      const t = restTime(rng);
      expect(t).toBeGreaterThanOrEqual(2);
      expect(t).toBeLessThanOrEqual(10);
    }
  });
});

describe('animalCount budget', async () => {
  const { animalCount, MAX_ANIMALS, MIN_ANIMALS } = await import('../../../src/explore/animals');
  it('spawns 6..8 animals when there are spots, none without', () => {
    expect(animalCount(0)).toBe(0);
    expect(animalCount(2)).toBe(MIN_ANIMALS);
    expect(animalCount(7)).toBe(7);
    expect(animalCount(40)).toBe(MAX_ANIMALS);
  });
});
