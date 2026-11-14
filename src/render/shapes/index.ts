import type { BlockShape, Rotation } from '../../core/types';
import type { ShapeTemplate } from './shapeBuilder';
import { buildTemplate } from './templates';

export type { ShapeTemplate } from './shapeBuilder';
export type PartShape = Exclude<BlockShape, 'cube'>;
export const PART_SHAPES: readonly PartShape[] = ['slope', 'slab', 'plate', 'wheel', 'cone', 'arch', 'pane', 'cylinder'];

const COS = [1, 0, -1, 0] as const;
const SIN = [0, 1, 0, -1] as const;

/**
 * Rotates a template by quarter turns about the vertical axis through the cell center, the same
 * way as content pictures and build cards: each quarter turn maps [x, z] -> [-z, x] about the
 * center, so the part's forward (north at r = 0) points east, south, west for r = 1, 2, 3.
 */
export function rotateTemplate(t: ShapeTemplate, rot: Rotation): ShapeTemplate {
  if (rot === 0) return t;
  const c = COS[rot];
  const s = SIN[rot];
  const positions = new Float32Array(t.positions.length);
  const normals = new Float32Array(t.normals.length);
  for (let i = 0; i < t.positions.length; i += 3) {
    const dx = t.positions[i] - 0.5;
    const dz = t.positions[i + 2] - 0.5;
    positions[i] = 0.5 + dx * c - dz * s;
    positions[i + 1] = t.positions[i + 1];
    positions[i + 2] = 0.5 + dx * s + dz * c;
    const nx = t.normals[i];
    const nz = t.normals[i + 2];
    normals[i] = nx * c - nz * s;
    normals[i + 1] = t.normals[i + 1];
    normals[i + 2] = nx * s + nz * c;
  }
  return { ...t, positions, normals };
}

const cache = new Map<string, ShapeTemplate>();

/** Cached template for a part shape at a rotation. Templates are immutable; share freely. */
export function shapeTemplate(shape: PartShape, rot: Rotation): ShapeTemplate {
  const key = `${shape}:${rot}`;
  let t = cache.get(key);
  if (!t) {
    t = rotateTemplate(buildTemplate(shape), rot);
    cache.set(key, t);
  }
  return t;
}

export function isPart(shape: BlockShape | undefined): shape is PartShape {
  return shape !== undefined && shape !== 'cube' && (PART_SHAPES as readonly string[]).includes(shape);
}
