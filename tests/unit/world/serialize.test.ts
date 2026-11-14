import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE, WORLD_SIZE, type SavedWorld, type WorldEntity } from '../../../src/core/types';
import { createWorld, deserializeWorld, validateSavedWorld } from '../../../src/world';

const c = (x: number, y: number, z: number) => ({ x, y, z });

const chest = (id: string, opened = false): WorldEntity => ({ id, kind: 'chest', cell: c(4, 5, 6), sticker: 'star', opened });

/** A world exactly as v1 of Tibu saved it. */
const V1_SAVE = {
  format: 'tibu-world',
  version: 1,
  themeId: 'meadow',
  palette: ['nature:grass', 'nature:dirt', 'colors:red'],
  blocks: [
    [0, 0, 0, 1],
    [0, 1, 0, 0],
    [23, 15, 23, 2],
    [12, 2, 12, 2],
  ],
};

describe('v1 saves', () => {
  it('load unchanged as a 24x16x24 island', () => {
    const w = deserializeWorld(structuredClone(V1_SAVE) as SavedWorld);
    expect(w.size).toEqual(WORLD_SIZE);
    expect(w.kind).toBe('island');
    expect(w.themeId).toBe('meadow');
    expect(w.count()).toBe(4);
    expect(w.get(c(0, 0, 0))).toBe('nature:dirt');
    expect(w.get(c(0, 1, 0))).toBe('nature:grass');
    expect(w.get(c(23, 15, 23))).toBe('colors:red');
    expect(w.getRotation(c(12, 2, 12))).toBe(0);
    expect(w.entities()).toEqual([]);
    const blocks = [...w.entries()].map(([cell, key]) => [cell.x, cell.y, cell.z, key]);
    expect(blocks).toHaveLength(4);
  });

  it('re-saves as v2 with the same blocks', () => {
    const saved = deserializeWorld(structuredClone(V1_SAVE) as SavedWorld).serialize();
    expect(saved.version).toBe(2);
    expect(saved.size).toEqual(WORLD_SIZE);
    expect(saved.kind).toBe('island');
    const flat = (s: { palette: readonly string[]; blocks: readonly (readonly number[])[] }) =>
      s.blocks.map((b) => `${b[0]},${b[1]},${b[2]}=${s.palette[b[3]]}`).sort();
    expect(flat(saved)).toEqual(flat(V1_SAVE));
  });

  it('validates v1 to an identical v1 copy', () => {
    expect(validateSavedWorld(V1_SAVE)).toEqual(V1_SAVE);
  });

  it('rejects rotated (5-element) entries in v1', () => {
    expect(validateSavedWorld({ ...V1_SAVE, blocks: [[1, 1, 1, 0, 2]] })?.blocks).toEqual([]);
  });
});

describe('v2 saves', () => {
  it('round-trips size, kind, seed, rotations and entities', () => {
    const w = createWorld('space', { size: BIG_WORLD_SIZE, kind: 'explore', seed: 1234 });
    w.place(c(95, 31, 95), 'parts:slope', 3);
    w.place(c(0, 0, 0), 'nature:moon-rock');
    w.setEntity(chest('a'));
    w.setEntity(chest('b'));
    w.setEntity(chest('a', true)); // replace by id
    const saved = w.serialize();
    expect(saved).toMatchObject({ version: 2, size: BIG_WORLD_SIZE, kind: 'explore', seed: 1234 });
    const rock = saved.palette.indexOf('nature:moon-rock');
    const slope = saved.palette.indexOf('parts:slope');
    expect(saved.blocks).toContainEqual([0, 0, 0, rock]);
    expect(saved.blocks).toContainEqual([95, 31, 95, slope, 3]);
    expect(saved.entities).toEqual([chest('a', true), chest('b')]);
    const loaded = deserializeWorld(JSON.parse(JSON.stringify(saved)));
    expect(loaded.size).toEqual(BIG_WORLD_SIZE);
    expect(loaded.kind).toBe('explore');
    expect(loaded.getRotation(c(95, 31, 95))).toBe(3);
    expect(loaded.entities()).toEqual([chest('a', true), chest('b')]);
    expect(loaded.canUndo()).toBe(false);
    expect(loaded.serialize()).toEqual(saved);
  });

  it('writes 4-element entries for unrotated blocks and omits an unknown seed', () => {
    const w = createWorld('meadow');
    w.place(c(1, 1, 1), 'colors:red', 0);
    const saved = w.serialize();
    expect(saved.blocks).toEqual([[1, 1, 1, 0]]);
    expect('seed' in saved).toBe(false);
  });

  it('entities are not undoable', () => {
    const w = createWorld('meadow');
    w.setEntity(chest('a'));
    expect(w.canUndo()).toBe(false);
  });

  it('missing size means the little island', () => {
    const v = validateSavedWorld({ ...V1_SAVE, version: 2 });
    expect(v?.size).toEqual(WORLD_SIZE);
    expect(v?.kind).toBe('island');
  });
});

describe('untrusted imports', () => {
  const base = { format: 'tibu-world', version: 2, themeId: 't', palette: ['a:b'], blocks: [[1, 1, 1, 0]] };

  it.each([
    { x: 1e9, y: 1e9, z: 1e9 },
    { x: 96, y: 32, z: 24 },
    { x: -24, y: 16, z: 24 },
    { x: '24', y: 16, z: 24 },
    'big',
    null,
  ])('rejects sizes outside the allow-list %#', (size) => {
    expect(validateSavedWorld({ ...base, size })).toBeNull();
    expect(deserializeWorld({ ...base, size } as never).size).toEqual(WORLD_SIZE);
  });

  it('rejects unknown kinds and oversized block arrays', () => {
    expect(validateSavedWorld({ ...base, kind: 'dungeon' })).toBeNull();
    const huge = new Array(24 * 16 * 24 * 2 + 1).fill([1, 1, 1, 0]);
    expect(validateSavedWorld({ ...base, blocks: huge })).toBeNull();
  });

  it('drops bad rotations, bad seeds and malformed entities', () => {
    const v = validateSavedWorld({
      ...base,
      seed: -5,
      blocks: [[1, 1, 1, 0, 9], [2, 2, 2, 0, 2], [3, 3, 3, 0, 0], [4, 4, 4, 0, 1.5]],
      entities: [chest('ok'), { ...chest('x'), kind: 'dragon' }, { id: 'y' }, 'z', chest('ok'), { ...chest('long'), sticker: 'x'.repeat(500) }],
    });
    expect(v?.seed).toBeUndefined();
    expect(v?.blocks).toEqual([[2, 2, 2, 0, 2], [3, 3, 3, 0]]);
    expect(v?.entities).toEqual([chest('ok')]);
  });

  it('skips out-of-bounds blocks for the declared size and never throws', () => {
    const w = deserializeWorld({ ...base, size: WORLD_SIZE, blocks: [[50, 1, 1, 0], [1, 1, 1, 0]] } as never);
    expect(w.count()).toBe(1);
    expect(() => deserializeWorld(undefined as never)).not.toThrow();
    expect(() => deserializeWorld({ format: 'tibu-world', version: 2, themeId: 'x'.repeat(10_000) } as never)).not.toThrow();
  });
});
