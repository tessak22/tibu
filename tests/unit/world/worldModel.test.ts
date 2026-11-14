import { describe, expect, it, vi } from 'vitest';
import type { ThemeDef } from '../../../src/core/types';
import {
  createWorld,
  createWorldFromTheme,
  deserializeWorld,
  islandMask,
  validateSavedWorld,
} from '../../../src/world';

const c = (x: number, y: number, z: number) => ({ x, y, z });

describe('place and remove', () => {
  it('places a block and reads it back', () => {
    const w = createWorld('meadow');
    const action = w.place(c(3, 2, 4), 'colors:red');
    expect(action).toEqual({ type: 'place', cell: c(3, 2, 4), block: 'colors:red' });
    expect(w.get(c(3, 2, 4))).toBe('colors:red');
    expect(w.count()).toBe(1);
  });

  it('refuses occupied cells', () => {
    const w = createWorld('meadow');
    w.place(c(1, 1, 1), 'colors:red');
    expect(w.place(c(1, 1, 1), 'colors:blue')).toBeNull();
    expect(w.get(c(1, 1, 1))).toBe('colors:red');
  });

  it('refuses out-of-bounds and non-integer cells', () => {
    const w = createWorld('meadow');
    for (const bad of [c(-1, 1, 1), c(24, 1, 1), c(1, 16, 1), c(1, 1, 24), c(1.5, 1, 1), c(NaN, 1, 1)]) {
      expect(w.inBounds(bad)).toBe(false);
      expect(w.place(bad, 'colors:red')).toBeNull();
      expect(w.get(bad)).toBeNull();
      expect(w.remove(bad)).toBeNull();
    }
    expect(w.inBounds(c(23, 15, 23))).toBe(true);
    expect(w.count()).toBe(0);
  });

  it('refuses empty block keys', () => {
    expect(createWorld('m').place(c(1, 1, 1), '')).toBeNull();
  });

  it('removes a block and returns what was there', () => {
    const w = createWorld('meadow');
    w.place(c(2, 3, 2), 'animals:cow');
    expect(w.remove(c(2, 3, 2))).toEqual({ type: 'remove', cell: c(2, 3, 2), block: 'animals:cow' });
    expect(w.get(c(2, 3, 2))).toBeNull();
    expect(w.remove(c(2, 3, 2))).toBeNull();
  });

  it('never removes the floor layer y=0', () => {
    const w = createWorld('meadow');
    w.place(c(5, 0, 5), 'nature:dirt');
    expect(w.remove(c(5, 0, 5))).toBeNull();
    expect(w.get(c(5, 0, 5))).toBe('nature:dirt');
  });

  it('has no gravity', () => {
    const w = createWorld('meadow');
    w.place(c(4, 10, 4), 'colors:red');
    expect(w.get(c(4, 10, 4))).toBe('colors:red');
  });

  it('lists entries', () => {
    const w = createWorld('meadow');
    w.place(c(1, 2, 3), 'a:b');
    w.place(c(4, 5, 6), 'a:c');
    const list = [...w.entries()].map(([cell, key]) => `${cell.x},${cell.y},${cell.z}=${key}`).sort();
    expect(list).toEqual(['1,2,3=a:b', '4,5,6=a:c']);
  });
});

describe('undo', () => {
  it('undoes a place by removing and a remove by restoring', () => {
    const w = createWorld('meadow');
    w.place(c(1, 1, 1), 'colors:red');
    w.remove(c(1, 1, 1));
    expect(w.undo()).toEqual({ type: 'place', cell: c(1, 1, 1), block: 'colors:red' });
    expect(w.get(c(1, 1, 1))).toBe('colors:red');
    expect(w.undo()).toEqual({ type: 'remove', cell: c(1, 1, 1), block: 'colors:red' });
    expect(w.get(c(1, 1, 1))).toBeNull();
    expect(w.canUndo()).toBe(false);
    expect(w.undo()).toBeNull();
  });

  it('keeps only the last 50 actions', () => {
    const w = createWorld('meadow');
    for (let i = 0; i < 60; i++) w.place(c(i % 24, 1 + Math.floor(i / 24), 0), 'colors:red');
    let undone = 0;
    while (w.undo()) undone++;
    expect(undone).toBe(50);
    expect(w.count()).toBe(10);
    expect(w.get(c(0, 1, 0))).toBe('colors:red');
    expect(w.get(c(10, 1, 0))).toBeNull();
  });

  it('does not record failed actions', () => {
    const w = createWorld('meadow');
    w.place(c(1, 1, 1), 'x:y');
    w.place(c(1, 1, 1), 'x:z');
    w.remove(c(9, 9, 9));
    w.undo();
    expect(w.canUndo()).toBe(false);
  });

  it('notifies listeners with cause, and unsubscribes', () => {
    const w = createWorld('meadow');
    const spy = vi.fn();
    const off = w.onChange(spy);
    w.place(c(1, 1, 1), 'x:y');
    w.undo();
    expect(spy).toHaveBeenNthCalledWith(1, { type: 'place', cell: c(1, 1, 1), block: 'x:y' }, 'action');
    expect(spy).toHaveBeenNthCalledWith(2, { type: 'remove', cell: c(1, 1, 1), block: 'x:y' }, 'undo');
    off();
    w.place(c(2, 2, 2), 'x:y');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips', () => {
    const w = createWorld('beach');
    w.place(c(0, 0, 0), 'nature:sand');
    w.place(c(23, 15, 23), 'colors:red');
    w.place(c(5, 5, 5), 'colors:red');
    const saved = w.serialize();
    expect(saved.format).toBe('tibu-world');
    expect(saved.palette).toEqual(['nature:sand', 'colors:red']);
    const json = JSON.parse(JSON.stringify(saved));
    const loaded = deserializeWorld(json);
    expect(loaded.themeId).toBe('beach');
    expect(loaded.count()).toBe(3);
    expect(loaded.get(c(23, 15, 23))).toBe('colors:red');
    expect(loaded.canUndo()).toBe(false);
    expect(loaded.serialize()).toEqual(saved);
  });

  it('skips out-of-bounds, duplicate and malformed entries without throwing', () => {
    const data = {
      format: 'tibu-world',
      version: 1,
      themeId: 'meadow',
      palette: ['a:b'],
      blocks: [[1, 1, 1, 0], [1, 1, 1, 0], [99, 0, 0, 0], [-1, 0, 0, 0], [1, 2, 3, 7], ['x', 1, 1, 0], [2, 2, 2]],
    } as never;
    const w = deserializeWorld(data);
    expect(w.count()).toBe(1);
  });

  it('returns an empty world for garbage', () => {
    expect(deserializeWorld(null as never).count()).toBe(0);
    expect(deserializeWorld({ format: 'nope' } as never).count()).toBe(0);
  });
});

describe('validateSavedWorld', () => {
  const good = { format: 'tibu-world', version: 1, themeId: 't', palette: ['a:b'], blocks: [[0, 1, 0, 0]] };
  it('accepts a valid world', () => {
    expect(validateSavedWorld(good)).toEqual(good);
  });
  it.each([
    null,
    42,
    'tibu',
    [],
    { ...good, format: 'other' },
    { ...good, version: 3 },
    { ...good, version: 2, size: { x: 1000, y: 1000, z: 1000 } },
    { ...good, themeId: 5 },
    { ...good, themeId: '' },
    { ...good, palette: 'a:b' },
    { ...good, palette: [3] },
    { ...good, blocks: {} },
  ])('rejects garbage %#', (bad) => {
    expect(validateSavedWorld(bad)).toBeNull();
  });
  it('drops malformed block entries', () => {
    expect(validateSavedWorld({ ...good, blocks: [[0, 1, 0, 0], [0, 1, 0, 3], 'x', [0.5, 1, 1, 0]] })?.blocks).toEqual([
      [0, 1, 0, 0],
    ]);
  });
});

describe('createWorldFromTheme', () => {
  const theme = {
    id: 'meadow',
    island: { shape: 'round', depth: 4 },
    ground: ['nature:grass', 'nature:dirt'],
    scene: [
      { x: 12, y: 2, z: 12, block: 'nature:wood' },
      { x: 99, y: 2, z: 12, block: 'nature:wood' },
    ],
  } as unknown as ThemeDef;

  it('fills ground layers top-down and adds the scene', () => {
    const w = createWorldFromTheme(theme);
    const groundColumns = islandMask('round').reduce((a, b) => a + b, 0);
    expect(w.count()).toBe(groundColumns * 2 + 1);
    expect(w.get(c(12, 1, 12))).toBe('nature:grass');
    expect(w.get(c(12, 0, 12))).toBe('nature:dirt');
    expect(w.get(c(0, 0, 0))).toBeNull();
    expect(w.get(c(12, 2, 12))).toBe('nature:wood');
    expect(w.canUndo()).toBe(false);
  });

  it('square islands cover the full footprint', () => {
    const w = createWorldFromTheme({ ...theme, island: { shape: 'square', depth: 3 }, scene: [] });
    expect(w.count()).toBe(24 * 24 * 2);
  });

  it('blob islands are smaller than square but non-empty', () => {
    const n = islandMask('blob').reduce((a, b) => a + b, 0);
    expect(n).toBeGreaterThan(200);
    expect(n).toBeLessThan(576);
  });
});
