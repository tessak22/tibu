/** Minimal in-memory WorldModel for learning tests (place, remove, undo, onChange). */
import type { BlockKey, Cell, WorldAction, WorldModel, WorldSize } from '../../../src/core/types';

export interface FakeWorld extends WorldModel {
  /** Fill the ground layer y=0..depth-1 over the whole world. */
  ground(block: BlockKey, depth?: number): void;
}

export function createFakeWorld(size: WorldSize = { x: 24, y: 16, z: 24 }): FakeWorld {
  const cells = new Map<string, BlockKey>();
  const key = (c: Cell) => `${c.x},${c.y},${c.z}`;
  const listeners = new Set<(a: WorldAction, cause: 'action' | 'undo') => void>();
  const history: WorldAction[] = [];
  const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < size.x && c.y < size.y && c.z < size.z;
  const fire = (a: WorldAction, cause: 'action' | 'undo') => {
    for (const l of [...listeners]) l(a, cause);
  };
  const world: FakeWorld = {
    themeId: 'meadow',
    size,
    kind: 'island',
    get: (c) => cells.get(key(c)) ?? null,
    getRotation: () => 0,
    inBounds,
    place(cell, block) {
      if (!inBounds(cell) || cells.has(key(cell))) return null;
      cells.set(key(cell), block);
      const a: WorldAction = { type: 'place', cell, block };
      history.push(a);
      fire(a, 'action');
      return a;
    },
    remove(cell) {
      const block = cells.get(key(cell));
      if (!block) return null;
      cells.delete(key(cell));
      const a: WorldAction = { type: 'remove', cell, block };
      history.push(a);
      fire(a, 'action');
      return a;
    },
    smash(cell) {
      return world.remove(cell);
    },
    entities: () => [],
    setEntity: () => undefined,
    undo() {
      const last = history.pop();
      if (!last || last.type === 'batch') return null;
      const inverse: WorldAction = last.type === 'place'
        ? { type: 'remove', cell: last.cell, block: last.block }
        : { type: 'place', cell: last.cell, block: last.block };
      if (inverse.type === 'remove') cells.delete(key(inverse.cell));
      else cells.set(key(inverse.cell), inverse.block);
      fire(inverse, 'undo');
      return inverse;
    },
    canUndo: () => history.length > 0,
    *entries() {
      for (const [k, b] of cells) {
        const [x, y, z] = k.split(',').map(Number);
        yield [{ x, y, z }, b] as const;
      }
    },
    count: () => cells.size,
    serialize: () => { throw new Error('not needed'); },
    onChange(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    ground(block, depth = 1) {
      for (let x = 0; x < size.x; x++) for (let z = 0; z < size.z; z++) for (let y = 0; y < depth; y++) cells.set(key({ x, y, z }), block);
    },
  };
  return world;
}
