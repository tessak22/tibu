/** Converts cell-space feet positions to world space using the view's cell centres. */
import type * as THREE from 'three';
import type { Cell, GameView } from '../core/types';

export interface Space {
  /** Writes the world position of feet standing at cell-space (x, y, z) into out. */
  feet(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3;
  readonly unit: number;
}

export function createSpace(view: Pick<GameView, 'cellCenter'>): Space {
  const o = view.cellCenter({ x: 0, y: 0, z: 0 });
  const one = view.cellCenter({ x: 1, y: 0, z: 0 });
  const unit = one.x - o.x || 1;
  return {
    unit,
    feet(x, y, z, out) {
      return out.set(o.x + x * unit, o.y + (y - 0.5) * unit, o.z + z * unit);
    },
  };
}

export const cellOf = (x: number, y: number, z: number): Cell => ({ x, y, z });
