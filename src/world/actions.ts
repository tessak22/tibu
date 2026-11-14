import type { BlockKey, Cell, Rotation, WorldAction } from '../core/types';

export const freezeCell = (c: Cell): Cell => Object.freeze({ x: c.x, y: c.y, z: c.z });

/** Builds a frozen place/remove action. `rot` is only included when non-zero. */
export function blockAction(type: 'place' | 'remove', c: Cell, block: BlockKey, rot: Rotation): WorldAction {
  return rot === 0
    ? Object.freeze({ type, cell: freezeCell(c), block })
    : Object.freeze({ type, cell: freezeCell(c), block, rot });
}

/** The action that reverses `action`. A batch is reversed as a batch, in reverse order. */
export function inverseOf(action: WorldAction): WorldAction {
  if (action.type === 'batch') {
    const actions = Object.freeze([...action.actions].reverse().map(inverseOf));
    return Object.freeze({ type: 'batch', reason: action.reason, actions });
  }
  return blockAction(action.type === 'place' ? 'remove' : 'place', action.cell, action.block, action.rot ?? 0);
}
