import type { ThemeDef } from '../core/types';
import { SIZE_X, SIZE_Z } from './grid';

export type IslandShape = ThemeDef['island']['shape'];

const CENTER_X = (SIZE_X - 1) / 2;
const CENTER_Z = (SIZE_Z - 1) / 2;
const MAX_RADIUS = Math.min(SIZE_X, SIZE_Z) / 2;

function blobRadius(angle: number): number {
  const r = MAX_RADIUS - 1.6 + 1.1 * Math.sin(3 * angle + 0.5) + 0.6 * Math.sin(5 * angle + 1.3);
  return Math.min(r, MAX_RADIUS - 0.1);
}

function isGround(shape: IslandShape, x: number, z: number): boolean {
  const dx = x - CENTER_X;
  const dz = z - CENTER_Z;
  switch (shape) {
    case 'square':
      return true;
    case 'round':
      return Math.hypot(dx, dz) <= MAX_RADIUS - 0.3;
    case 'blob':
      return Math.hypot(dx, dz) <= blobRadius(Math.atan2(dz, dx));
    default:
      return Math.hypot(dx, dz) <= MAX_RADIUS - 0.3;
  }
}

/**
 * Which (x, z) columns are island ground. Index = x + z * SIZE_X; 1 = ground.
 * Deterministic so the renderer's rocky underside always matches the world's ground.
 */
export function islandMask(shape: IslandShape): Uint8Array {
  const mask = new Uint8Array(SIZE_X * SIZE_Z);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) mask[x + z * SIZE_X] = isGround(shape, x, z) ? 1 : 0;
  }
  return mask;
}
