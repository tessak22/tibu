import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE, type ThemeDef } from '../../../src/core/types';
import { createExploreWorld, isReachable, standable } from '../../../src/world';
import { neighbors } from '../../../src/world/walk';

const theme = (id: string, ground: string[]): ThemeDef =>
  ({ id, name: id, voiceLine: '', island: { shape: 'round', depth: 4 }, ground, scene: [], sky: { top: '', bottom: '' } }) as unknown as ThemeDef;

const THEMES = [
  theme('meadow', ['nature:grass', 'nature:dirt']),
  theme('beach', ['nature:sand', 'nature:sand']),
  theme('farm', ['nature:grass', 'nature:dirt']),
  theme('snow', ['nature:snow', 'nature:stone']),
  theme('space', ['nature:moon-rock', 'nature:moon-rock']),
];

const KNOWN = new Set([
  ...['grass', 'dirt', 'sand', 'water', 'wood', 'leaves', 'flowers', 'stone', 'snow', 'ice', 'hay', 'moon-rock'].map((b) => `nature:${b}`),
  ...['brick', 'wall', 'planks', 'window', 'door', 'roof', 'blue-roof', 'glass', 'lamp', 'star-light', 'heart-light'].map((b) => `building:${b}`),
]);

describe('createExploreWorld', () => {
  it('is deterministic per seed', () => {
    const a = createExploreWorld(THEMES[0], 7);
    const b = createExploreWorld(THEMES[0], 7);
    const other = createExploreWorld(THEMES[0], 8);
    expect(a.world.serialize()).toEqual(b.world.serialize());
    expect([a.spawn, a.chestSpots, a.animalSpots]).toEqual([b.spawn, b.chestSpots, b.animalSpots]);
    expect(other.world.serialize()).not.toEqual(a.world.serialize());
    expect(a.world.serialize().seed).toBe(7);
  });

  it.each(THEMES.flatMap((t) => [1, 42, 2024].map((seed) => [t.id, t, seed] as const)))(
    '%s seed %i: bounds, block sanity, reachable spots',
    (_id, t, seed) => {
      const { world, spawn, chestSpots, animalSpots } = createExploreWorld(t, seed);
      expect(world.size).toEqual(BIG_WORLD_SIZE);
      expect(world.kind).toBe('explore');
      expect(world.canUndo()).toBe(false);

      let floor = 0;
      for (const [cell, key] of world.entries()) {
        expect(world.inBounds(cell)).toBe(true);
        expect(KNOWN.has(key)).toBe(true);
        if (cell.y === 0) floor++;
      }
      expect(world.count()).toBeGreaterThan(6_000);
      expect(world.count()).toBeLessThan(60_000);
      expect(floor).toBeGreaterThan(1_200); // 4-6 islands of ground

      expect(standable(world, spawn)).toBe(true);
      expect(chestSpots.length).toBeGreaterThanOrEqual(8);
      expect(chestSpots.length).toBeLessThanOrEqual(12);
      expect(animalSpots.length).toBeGreaterThanOrEqual(4);
      for (const spot of [...chestSpots, ...animalSpots]) {
        expect(standable(world, spot)).toBe(true);
        expect(isReachable(world, spawn, spot)).toBe(true);
      }
      const keys = new Set(chestSpots.map((s) => `${s.x},${s.y},${s.z}`));
      expect(keys.size).toBe(chestSpots.length);
    },
  );

  it('leaves open flat building space around the spawn', () => {
    const { world, spawn } = createExploreWorld(THEMES[0], 3);
    let open = 0;
    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        if (standable(world, { x: spawn.x + dx, y: spawn.y, z: spawn.z + dz })) open++;
      }
    }
    expect(open).toBe(121);
  });

  it('spreads chests over the islands (at least 3 far apart groups)', () => {
    const { chestSpots, spawn } = createExploreWorld(THEMES[1], 11);
    const far = chestSpots.filter((s) => Math.hypot(s.x - spawn.x, s.z - spawn.z) > 20);
    expect(far.length).toBeGreaterThanOrEqual(3);
  });

  it('every walkable neighbour step on the ground is at most one block', () => {
    const { world, spawn } = createExploreWorld(THEMES[3], 5);
    for (const n of neighbors(world, spawn)) expect(Math.abs(n.y - spawn.y)).toBeLessThanOrEqual(1);
  });

  it('generates a 96x32x96 world quickly', () => {
    const t0 = performance.now();
    createExploreWorld(THEMES[4], 99);
    expect(performance.now() - t0).toBeLessThan(1_000);
  });
});
