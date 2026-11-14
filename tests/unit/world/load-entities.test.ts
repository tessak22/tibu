import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE, type SavedWorld, type WorldEntity } from '../../../src/core/types';
import { createWorld, deserializeWorld } from '../../../src/world';
import { MAX_LOADED_ENTITIES, loadableEntities } from '../../../src/world/load';

const c = (x: number, y: number, z: number) => ({ x, y, z });
const chest = (id: string, x: number, y: number, z: number): WorldEntity => ({
  id,
  kind: 'chest',
  cell: c(x, y, z),
  sticker: 'star',
  opened: false,
});

/** A little world with a grass floor; serialized with the given entities patched in. */
function saveWith(entities: readonly WorldEntity[]): SavedWorld {
  const w = createWorld('meadow');
  for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) w.place(c(x, 0, z), 'nature:grass');
  w.place(c(2, 1, 2), 'colors:red');
  return { ...w.serialize(), entities: [...entities] } as SavedWorld;
}

describe('loading entities', () => {
  it('keeps entities in empty in-bounds cells', () => {
    const w = deserializeWorld(saveWith([chest('a', 1, 1, 1), chest('b', 3, 1, 3)]));
    expect(w.entities().map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('drops entities outside the world', () => {
    const w = deserializeWorld(saveWith([chest('out-x', 500, 1, 1), chest('neg', -1, 1, 1), chest('high', 1, 99, 1), chest('ok', 1, 1, 1)]));
    expect(w.entities().map((e) => e.id)).toEqual(['ok']);
  });

  it('drops entities buried inside solid blocks', () => {
    const w = deserializeWorld(saveWith([chest('in-floor', 1, 0, 1), chest('in-red', 2, 1, 2), chest('ok', 3, 1, 3)]));
    expect(w.entities().map((e) => e.id)).toEqual(['ok']);
  });

  it('caps the number of loaded entities', () => {
    const many: WorldEntity[] = [];
    for (let i = 0; i < MAX_LOADED_ENTITIES + 40; i++) many.push(chest(`c${i}`, i % 90, 5, Math.floor(i / 90)));
    const model = { inBounds: () => true, get: () => null };
    const kept = loadableEntities(model, many);
    expect(kept).toHaveLength(MAX_LOADED_ENTITIES);
    expect(kept[0]?.id).toBe('c0');
  });

  it('caps entities when loading a real big world', () => {
    const big = createWorld('meadow', { size: BIG_WORLD_SIZE });
    const many: WorldEntity[] = [];
    for (let i = 0; i < MAX_LOADED_ENTITIES + 10; i++) many.push(chest(`c${i}`, i % 90, 5, Math.floor(i / 90)));
    const w = deserializeWorld({ ...big.serialize(), entities: many } as SavedWorld);
    expect(w.entities()).toHaveLength(MAX_LOADED_ENTITIES);
  });
});
