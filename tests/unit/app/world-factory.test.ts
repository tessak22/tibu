// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ThemeDef } from '../../../src/core/types';
import { chooseAnchor } from '../../../src/app/blueprint-anchor';
import {
  canOpenRecord,
  centerStandCell,
  exploreSetupForRecord,
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
    validateSavedWorld: vi.fn((data: unknown) => ((data as { version?: number })?.version === 2 ? (data as never) : null)),
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

const cellsOf = (anchor: { x: number; y: number; z: number }, bp: ReturnType<typeof fakeBlueprint>) =>
  bp.steps.flatMap((st) => st.blocks).map((b) => ({ x: anchor.x + b.x, y: anchor.y + b.y, z: anchor.z + b.z }));

describe('blueprint anchor (the one algorithm)', () => {
  const character = { x: 12, y: 1, z: 12 };

  it.each([
    [0, { dz: -1 }],
    [1, { dx: 1 }],
    [2, { dz: 1 }],
    [3, { dx: -1 }],
  ] as const)('explore: 2 to 4 cells in front of the character for facing %i', (facing, dir) => {
    const w = fakeWorld();
    const bp = fakeBlueprint('house');
    const anchor = chooseAnchor(w, bp, { kind: 'explore', character, facing })!;
    expect(anchor).not.toBeNull();
    for (const c of cellsOf(anchor, bp)) {
      const ahead = 'dx' in dir ? (c.x - character.x) * dir.dx : (c.z - character.z) * (dir as { dz: number }).dz;
      expect(ahead).toBeGreaterThanOrEqual(2);
      expect(ahead).toBeLessThanOrEqual(5);
    }
    expect(anchor.y).toBe(1);
  });

  it('explore: never covers the character or the cells next to it, even when the front is blocked', () => {
    const w = fakeWorld();
    for (let x = 13; x <= 18; x++) for (let z = 8; z <= 16; z++) w.place({ x, y: 1, z }, 'colors:red');
    const bp = fakeBlueprint('house');
    const anchor = chooseAnchor(w, bp, { kind: 'explore', character, facing: 1 })!;
    expect(anchor).not.toBeNull();
    for (const c of cellsOf(anchor, bp)) {
      expect(Math.max(Math.abs(c.x - character.x), Math.abs(c.z - character.z))).toBeGreaterThanOrEqual(2);
      expect(w.get(c)).toBeNull();
    }
  });

  it('explore: prefers a flat spot', () => {
    const w = fakeWorld();
    w.place({ x: 15, y: 1, z: 12 }, 'colors:red'); // A bump right where the build would start.
    const anchor = chooseAnchor(w, fakeBlueprint('house'), { kind: 'explore', character, facing: 1 })!;
    const below = cellsOf(anchor, fakeBlueprint('house')).filter((c) => c.y === anchor.y);
    expect(new Set(below.map((c) => w.get({ ...c, y: c.y - 1 })))).toEqual(new Set(['nature:grass']));
  });

  it('island: near the view centre', () => {
    const w = fakeWorld();
    expect(chooseAnchor(w, fakeBlueprint('house'), { kind: 'island', center: { x: 12, z: 12 } })).toEqual({ x: 12, y: 1, z: 12 });
  });

  it('island: wider search when the middle is full, and stays inside the world at the edge', () => {
    const w = fakeWorld();
    for (let x = 6; x <= 18; x++) for (let z = 6; z <= 18; z++) w.place({ x, y: 1, z }, 'colors:red');
    const anchor = chooseAnchor(w, fakeBlueprint('house'), { kind: 'island', center: { x: 12, z: 12 } })!;
    expect(anchor).not.toBeNull();
    const edge = chooseAnchor(fakeWorld(), fakeBlueprint('house'), { kind: 'island', center: { x: 23, z: 23 } })!;
    expect(edge.x + 1).toBeLessThan(24);
  });

  it('returns null when nothing fits anywhere', () => {
    const w = fakeWorld({ x: 4, y: 2, z: 4 }, 1);
    expect(chooseAnchor(w, fakeBlueprint('house'), { kind: 'island', center: { x: 2, z: 2 } })).toBeNull();
  });
});

describe('records that cannot be opened', () => {
  it('only opens records whose data validates', () => {
    const f = factory();
    expect(canOpenRecord(f, { data: { version: 2 } as never })).toBe(true);
    expect(canOpenRecord(f, { data: { version: 9 } as never })).toBe(false);
    (f.validateSavedWorld as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('bad');
    });
    expect(canOpenRecord(f, { data: { version: 2 } as never })).toBe(false);
  });
});

describe('saved explore state', () => {
  const data = { format: 'tibu-world', version: 2, themeId: 'meadow', seed: 9, palette: [], blocks: [] } as const;

  it('uses the saved spawn and animal spots without regenerating, and returns to the last cell', () => {
    const f = factory();
    const world = fakeWorld({ x: 96, y: 32, z: 96 });
    const setup = exploreSetupForRecord(f, world, theme, {
      data,
      explore: { spawn: { x: 5, y: 1, z: 5 }, animalSpots: [{ x: 7, y: 1, z: 7 }], lastCell: { x: 30, y: 1, z: 31 } },
    });
    expect(f.createExploreWorld).not.toHaveBeenCalled();
    expect(setup).toEqual({ spawn: { x: 30, y: 1, z: 31 }, animalSpots: [{ x: 7, y: 1, z: 7 }], home: { x: 5, y: 1, z: 5 } });
  });

  it('falls back to the saved spawn when the last cell is now filled', () => {
    const f = factory();
    const world = fakeWorld({ x: 96, y: 32, z: 96 });
    world.place({ x: 30, y: 1, z: 31 }, 'colors:red');
    const setup = exploreSetupForRecord(f, world, theme, {
      data,
      explore: { spawn: { x: 5, y: 1, z: 5 }, animalSpots: [], lastCell: { x: 30, y: 1, z: 31 } },
    });
    expect(setup.spawn).toEqual({ x: 5, y: 1, z: 5 });
  });

  it('old saves (or junk) regenerate from the seed', () => {
    const f = factory();
    const world = fakeWorld({ x: 96, y: 32, z: 96 });
    expect(exploreSetupForRecord(f, world, theme, { data }).spawn).toEqual({ x: 40, y: 1, z: 40 });
    expect(exploreSetupForRecord(f, world, theme, { data, explore: { spawn: { x: -1 } } as never }).spawn).toEqual({
      x: 40,
      y: 1,
      z: 40,
    });
    expect(f.createExploreWorld).toHaveBeenCalledTimes(2);
  });
});
