import type { Cell, WorldEntity, WorldModel } from '../../../src/core/types';

/** Minimal in-memory world for explore logic tests. */
export function fakeWorld(sx = 12, sy = 8, sz = 12): WorldModel & { entityList: WorldEntity[] } {
  const blocks = new Map<string, string>();
  const entityList: WorldEntity[] = [];
  const k = (c: Cell): string => `${c.x},${c.y},${c.z}`;
  const size = { x: sx, y: sy, z: sz };
  const inBounds = (c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < sx && c.y < sy && c.z < sz;
  const world = {
    themeId: 'meadow',
    size,
    kind: 'explore' as const,
    entityList,
    get: (c: Cell) => blocks.get(k(c)) ?? null,
    getRotation: () => 0 as const,
    inBounds,
    place(c: Cell, b: string) {
      if (!inBounds(c) || blocks.has(k(c))) return null;
      blocks.set(k(c), b);
      return { type: 'place' as const, cell: c, block: b };
    },
    remove(c: Cell) {
      const b = blocks.get(k(c));
      if (!b) return null;
      blocks.delete(k(c));
      return { type: 'remove' as const, cell: c, block: b };
    },
    smash: () => null,
    entities: () => entityList,
    setEntity(e: WorldEntity) {
      const i = entityList.findIndex((x) => x.id === e.id);
      if (i >= 0) entityList.splice(i, 1, e);
      else entityList.push(e);
    },
    undo: () => null,
    canUndo: () => false,
    entries: () => [],
    count: () => blocks.size,
    serialize: () => {
      throw new Error('not needed');
    },
    onChange: () => () => undefined,
  };
  return world as unknown as WorldModel & { entityList: WorldEntity[] };
}

/** Fills a flat floor at y = 0 over the whole world. */
export function floor(world: WorldModel, x0 = 0, z0 = 0, x1 = world.size.x - 1, z1 = world.size.z - 1): void {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) world.place({ x, y: 0, z }, 'nature:grass');
}
