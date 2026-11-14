// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ThemeDef } from '../../../src/core/types';
import { findAnchor, fits } from '../../../src/app/blueprint-anchor';
import {
  centerStandCell,
  createNewWorld,
  exploreSetupFor,
  randomSeed,
  standCell,
  stickersToHide,
  type WorldFactory,
} from '../../../src/app/world-factory';
import { fakeBlueprint } from '../ui/helpers';
import { fakeWorld } from './fake-world';

const theme = { id: 'meadow' } as ThemeDef;

const factory = (): WorldFactory => {
  const island = fakeWorld();
  const big = fakeWorld({ x: 96, y: 32, z: 96 });
  return {
    createWorldFromTheme: vi.fn(() => island),
    deserializeWorld: vi.fn(() => island),
    createExploreWorld: vi.fn(() => ({
      world: big,
      spawn: { x: 40, y: 1, z: 40 },
      chestSpots: [{ x: 10, y: 1, z: 10 }],
      animalSpots: [{ x: 20, y: 1, z: 20 }],
    })),
    placeChests: vi.fn(),
  };
};

describe('new worlds per kind', () => {
  it('island worlds are made exactly as before', () => {
    const f = factory();
    const made = createNewWorld(f, theme, 'island', ['sun']);
    expect(f.createWorldFromTheme).toHaveBeenCalledWith(theme);
    expect(f.createExploreWorld).not.toHaveBeenCalled();
    expect(made.explore).toBeNull();
  });

  it('adventure worlds use the explore generator and hide the stickers not found yet', () => {
    const f = factory();
    const made = createNewWorld(f, theme, 'explore', ['sun', 'moon'], 1234);
    expect(f.createExploreWorld).toHaveBeenCalledWith(theme, 1234);
    expect(f.placeChests).toHaveBeenCalledWith(made.world, [{ x: 10, y: 1, z: 10 }], ['sun', 'moon'], 1234);
    expect(made.explore).toEqual({ spawn: { x: 40, y: 1, z: 40 }, animalSpots: [{ x: 20, y: 1, z: 20 }] });
  });

  it('stickersToHide skips found ones', () => {
    expect(stickersToHide(['a', 'b', 'c'], { stickers: ['b'] })).toEqual(['a', 'c']);
    expect(stickersToHide(['a'], {})).toEqual(['a']);
  });

  it('random seeds are positive integers', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const s = randomSeed(() => r);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });
});

describe('reopening an explore world', () => {
  it('regenerates spawn and animal spots from the saved seed', () => {
    const f = factory();
    const world = fakeWorld({ x: 96, y: 32, z: 96 });
    expect(exploreSetupFor(f, world, theme, 77).spawn).toEqual({ x: 40, y: 1, z: 40 });
    expect(f.createExploreWorld).toHaveBeenCalledWith(theme, 77);
  });

  it('falls back to the middle without a seed or when generation fails', () => {
    const f = factory();
    const world = fakeWorld({ x: 96, y: 32, z: 96 });
    expect(exploreSetupFor(f, world, theme, undefined)).toEqual({ spawn: { x: 48, y: 1, z: 48 }, animalSpots: [] });
    (f.createExploreWorld as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('boom');
    });
    expect(exploreSetupFor(f, world, theme, 5).spawn).toEqual({ x: 48, y: 1, z: 48 });
  });
});

describe('standing cells', () => {
  it('finds the cell above the top block', () => {
    const w = fakeWorld(undefined, 2);
    expect(standCell(w, 3, 3)).toEqual({ x: 3, y: 3, z: 3 });
    expect(centerStandCell(w)).toEqual({ x: 12, y: 3, z: 12 });
  });
});

describe('blueprint anchor', () => {
  it('anchors on the ground near the child', () => {
    const w = fakeWorld();
    const anchor = findAnchor(w, fakeBlueprint('house'), { x: 12, z: 12 });
    expect(anchor).toEqual({ x: 12, y: 1, z: 12 });
  });

  it('moves away from blocks in the way and from the character', () => {
    const w = fakeWorld();
    w.place({ x: 12, y: 1, z: 12 }, 'colors:red');
    const bp = fakeBlueprint('house');
    const anchor = findAnchor(w, bp, { x: 12, z: 12 }, { x: 13, y: 1, z: 12 });
    expect(fits(w, bp, anchor, { x: 13, y: 1, z: 12 })).toBe(true);
    expect(Math.abs(anchor.x - 12) + Math.abs(anchor.z - 12)).toBeLessThanOrEqual(4);
  });

  it('stays inside the world at the edge', () => {
    const w = fakeWorld();
    const anchor = findAnchor(w, fakeBlueprint('house'), { x: 23, z: 23 });
    expect(anchor.x + 1).toBeLessThan(24);
  });
});
