import { WORLD_SIZE, type BlockKey, type Cell, type Rotation, type WorldAction, type WorldModel, type WorldSize } from '../core/types';
import { blockAction, inverseOf } from './actions';
import { DenseGrid } from './denseGrid';
import { EntityStore } from './entities';
import { FLOOR_Y, UNDO_LIMIT, allowedSize, inBoundsIn, toRotation } from './grid';
import { serializeGrid } from './serialize';
import { ToppleSearch } from './topple';

type ChangeListener = (change: WorldAction, cause: 'action' | 'undo') => void;

export type WorldKind = WorldModel['kind'];

export interface WorldOptions {
  /** Must be one of ALLOWED_SIZES; anything else falls back to WORLD_SIZE. */
  readonly size?: WorldSize;
  readonly kind?: WorldKind;
  /** Generator seed of an explore world; written to saves. */
  readonly seed?: number;
}

/** A world model plus a privileged, non-undoable, silent writer used while building initial state. */
export interface SeedableWorld {
  readonly model: WorldModel;
  /** Writes (or overwrites) a block without recording undo or notifying listeners. False when out of bounds. */
  seed(cell: Cell, block: BlockKey, rot?: Rotation): boolean;
  /** Clears a cell silently (generators carving terrain). */
  clear(cell: Cell): void;
}

function isValidKey(block: unknown): block is BlockKey {
  return typeof block === 'string' && block.length > 0;
}

/**
 * Creates a bounded world (24x16x24 by default) with no gravity and a 50-step undo stack.
 *
 * Ground rule: `remove` and `smash` refuse cells on the floor layer (y = 0). The floor is
 * therefore unsmashable and the world can never get holes. Upper ground layers can be
 * smashed freely. Undo is not affected by this rule (undoing a place always removes it).
 * A collapse (smash with topple) is a single 'batch' action: one undo step, one change event.
 */
export function createSeedableWorld(themeId: string, options: WorldOptions = {}): SeedableWorld {
  const size = allowedSize(options.size) ?? WORLD_SIZE;
  const kind: WorldKind = options.kind === 'explore' ? 'explore' : 'island';
  const seedValue = Number.isInteger(options.seed) ? (options.seed as number) >>> 0 : undefined;
  const grid = new DenseGrid(size);
  const topple = new ToppleSearch(grid);
  const entityStore = new EntityStore();
  const undoStack: WorldAction[] = [];
  const listeners = new Set<ChangeListener>();

  const emit = (change: WorldAction, cause: 'action' | 'undo'): void => {
    for (const listener of [...listeners]) {
      try {
        listener(change, cause);
      } catch (error) {
        // A broken listener must not corrupt the model; report it asynchronously instead.
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  };

  const record = (action: WorldAction): void => {
    undoStack.push(action);
    if (undoStack.length > UNDO_LIMIT) undoStack.splice(0, undoStack.length - UNDO_LIMIT);
  };

  const commit = (action: WorldAction): WorldAction => {
    record(action);
    emit(action, 'action');
    return action;
  };

  const apply = (action: WorldAction): void => {
    if (action.type === 'batch') {
      for (const part of action.actions) apply(part);
      return;
    }
    const { x, y, z } = action.cell;
    grid.set(x, y, z, action.type === 'place' ? action.block : null, action.rot ?? 0);
  };

  const inBounds = (c: Cell): boolean => typeof c === 'object' && c !== null && inBoundsIn(size, c.x, c.y, c.z);
  const get = (c: Cell): BlockKey | null => (inBounds(c) ? grid.get(c.x, c.y, c.z) : null);

  /** Clears a smashable cell and returns the remove action (not yet recorded), or null. */
  const takeOut = (c: Cell): WorldAction | null => {
    if (!inBounds(c) || c.y === FLOOR_Y) return null;
    const block = grid.get(c.x, c.y, c.z);
    if (block === null) return null;
    const rot = grid.rotAt(c.x, c.y, c.z);
    grid.set(c.x, c.y, c.z, null);
    return blockAction('remove', c, block, rot);
  };

  const model: WorldModel = {
    themeId,
    size,
    kind,
    get,
    getRotation: (c) => (inBounds(c) ? grid.rotAt(c.x, c.y, c.z) : 0),
    inBounds,
    place(c, block, rot) {
      if (!inBounds(c) || !isValidKey(block) || grid.get(c.x, c.y, c.z) !== null) return null;
      const r = toRotation(rot);
      grid.set(c.x, c.y, c.z, block, r);
      return commit(blockAction('place', c, block, r));
    },
    remove(c) {
      const action = takeOut(c);
      return action ? commit(action) : null;
    },
    smash(c, options) {
      const first = takeOut(c);
      if (!first) return null;
      const fallen = options?.topple ? topple.collapse(c) : [];
      if (fallen.length === 0) return commit(first);
      const parts: WorldAction[] = [first];
      for (const f of fallen) {
        const block = grid.get(f.x, f.y, f.z) as BlockKey;
        parts.push(blockAction('remove', f, block, grid.rotAt(f.x, f.y, f.z)));
        grid.set(f.x, f.y, f.z, null);
      }
      return commit(Object.freeze({ type: 'batch', reason: 'collapse', actions: Object.freeze(parts) }));
    },
    entities: () => entityStore.list(),
    setEntity(entity) {
      entityStore.set(entity);
    },
    undo() {
      const last = undoStack.pop();
      if (!last) return null;
      const inverse = inverseOf(last);
      apply(inverse);
      emit(inverse, 'undo');
      return inverse;
    },
    canUndo: () => undoStack.length > 0,
    entries: () => grid.entries(),
    count: () => grid.count(),
    serialize: () =>
      serializeGrid({ themeId, size, kind, seed: seedValue }, grid.entriesWithRotation(), entityStore.list()),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  const seed = (c: Cell, block: BlockKey, rot?: Rotation): boolean =>
    inBounds(c) && isValidKey(block) && grid.set(c.x, c.y, c.z, block, toRotation(rot));
  const clear = (c: Cell): void => {
    if (inBounds(c)) grid.set(c.x, c.y, c.z, null);
  };

  return { model: Object.freeze(model), seed, clear };
}

/** An empty world (24x16x24 island unless options say otherwise). */
export function createWorld(themeId: string, options?: WorldOptions): WorldModel {
  return createSeedableWorld(themeId, options).model;
}
