import type { BlockKey, Cell, WorldModel, WorldSize } from '../../../src/core/types';

/** Minimal in-memory world for app tests (independent of src/world internals). */
export function fakeWorld(size: WorldSize = { x: 24, y: 16, z: 24 }, groundY = 0): WorldModel {
  const cells = new Map<string, BlockKey>();
  const key = (c: Cell): string => `${c.x},${c.y},${c.z}`;
  for (let x = 0; x < size.x; x++) for (let z = 0; z < size.z; z++) for (let y = 0; y <= groundY; y++) cells.set(key({ x, y, z }), 'nature:grass');
  const inBounds = (c: Cell): boolean =>
    c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < size.x && c.y < size.y && c.z < size.z;
  const world = {
    themeId: 'meadow',
    size,
    kind: 'island' as const,
    get: (c: Cell) => cells.get(key(c)) ?? null,
    getRotation: () => 0 as const,
    inBounds,
    place(c: Cell, block: BlockKey) {
      if (!inBounds(c) || cells.has(key(c))) return null;
      cells.set(key(c), block);
      return { type: 'place' as const, cell: c, block };
    },
    remove(c: Cell) {
      const block = cells.get(key(c));
      if (!block) return null;
      cells.delete(key(c));
      return { type: 'remove' as const, cell: c, block };
    },
    smash(c: Cell) {
      return world.remove(c);
    },
    entities: () => [],
    setEntity: () => undefined,
    undo: () => null,
    canUndo: () => false,
    entries: () => [],
    count: () => cells.size,
    serialize: () => ({ format: 'tibu-world' as const, version: 2 as const, themeId: 'meadow', palette: [], blocks: [] }),
    onChange: () => () => undefined,
  };
  return world as unknown as WorldModel;
}
