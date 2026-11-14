import type { BlockKey, Cell, SavedWorld, WorldAction, WorldModel } from '../core/types';
import { DenseGrid } from './denseGrid';
import { FLOOR_Y, UNDO_LIMIT, inBounds } from './grid';
import { serializeGrid } from './serialize';

type ChangeListener = (change: WorldAction, cause: 'action' | 'undo') => void;

/** A world model plus a privileged, non-undoable, silent writer used while building initial state. */
export interface SeedableWorld {
  readonly model: WorldModel;
  /** Writes a block without recording undo or notifying listeners. Returns false when out of bounds. */
  seed(cell: Cell, block: BlockKey): boolean;
}

const freezeCell = (c: Cell): Cell => Object.freeze({ x: c.x, y: c.y, z: c.z });

function isValidKey(block: unknown): block is BlockKey {
  return typeof block === 'string' && block.length > 0;
}

/**
 * Creates a bounded 24x16x24 world with no gravity and a 50-step undo stack.
 *
 * Ground rule: `remove` refuses cells on the floor layer (y = 0). The island floor is
 * therefore unsmashable and the island can never get holes. Upper ground layers can be
 * smashed freely. Undo is not affected by this rule (undoing a place always removes it).
 */
export function createSeedableWorld(themeId: string): SeedableWorld {
  const grid = new DenseGrid();
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

  const get = (c: Cell): BlockKey | null => (inBounds(c) ? grid.get(c.x, c.y, c.z) : null);

  const model: WorldModel = {
    themeId,
    get,
    inBounds,
    place(c, block) {
      if (!inBounds(c) || !isValidKey(block) || grid.get(c.x, c.y, c.z) !== null) return null;
      grid.set(c.x, c.y, c.z, block);
      const action: WorldAction = Object.freeze({ type: 'place', cell: freezeCell(c), block });
      record(action);
      emit(action, 'action');
      return action;
    },
    remove(c) {
      if (!inBounds(c) || c.y === FLOOR_Y) return null;
      const block = grid.get(c.x, c.y, c.z);
      if (block === null) return null;
      grid.set(c.x, c.y, c.z, null);
      const action: WorldAction = Object.freeze({ type: 'remove', cell: freezeCell(c), block });
      record(action);
      emit(action, 'action');
      return action;
    },
    undo() {
      const last = undoStack.pop();
      if (!last) return null;
      const { cell: c, block } = last;
      const inverse: WorldAction =
        last.type === 'place'
          ? Object.freeze({ type: 'remove', cell: c, block })
          : Object.freeze({ type: 'place', cell: c, block });
      grid.set(c.x, c.y, c.z, inverse.type === 'place' ? block : null);
      emit(inverse, 'undo');
      return inverse;
    },
    canUndo: () => undoStack.length > 0,
    entries: () => grid.entries(),
    count: () => grid.count(),
    serialize: (): SavedWorld => serializeGrid(themeId, grid.entries()),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  const seed = (c: Cell, block: BlockKey): boolean =>
    inBounds(c) && isValidKey(block) && grid.set(c.x, c.y, c.z, block);

  return { model: Object.freeze(model), seed };
}

/** An empty world. */
export function createWorld(themeId: string): WorldModel {
  return createSeedableWorld(themeId).model;
}
