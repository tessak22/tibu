import { SIZE_X, SIZE_Z } from '../../world/grid';

export interface UndersideArrays {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}

/** Deterministic hash noise in [0, 1). */
export function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Distance (in cells, capped) from each ground column to the nearest non-ground column. */
function edgeDistance(mask: Uint8Array): Float32Array {
  const dist = new Float32Array(SIZE_X * SIZE_Z);
  const cap = 12;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (!mask[x + z * SIZE_X]) continue;
      let best = cap;
      for (let dz = -cap; dz <= cap; dz++) {
        for (let dx = -cap; dx <= cap; dx++) {
          const ox = x + dx;
          const oz = z + dz;
          const outside = ox < 0 || oz < 0 || ox >= SIZE_X || oz >= SIZE_Z || !mask[ox + oz * SIZE_X];
          if (outside) best = Math.min(best, Math.hypot(dx, dz));
        }
      }
      dist[x + z * SIZE_X] = best;
    }
  }
  return dist;
}

/** Depth (in blocks) of the rock under each column: deep in the middle, shallow at the rim. */
export function columnDepths(mask: Uint8Array, maxDepth: number): Float32Array {
  const depth = Math.max(1, Math.min(32, Math.floor(maxDepth) || 1));
  const dist = edgeDistance(mask);
  let maxDist = 1;
  for (const d of dist) maxDist = Math.max(maxDist, d);
  const out = new Float32Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < out.length; i++) {
    if (!mask[i]) continue;
    const t = Math.min(1, dist[i] / maxDist);
    const x = i % SIZE_X;
    const z = Math.floor(i / SIZE_X);
    const jitter = (hash2(x, z) - 0.5) * 0.9;
    out[i] = Math.max(0.6, Math.round((0.6 + Math.sqrt(t) * depth + jitter) * 2) / 2);
  }
  return out;
}

const ROCK_TOP: readonly [number, number, number] = [0.72, 0.6, 0.5];
const ROCK_BOTTOM: readonly [number, number, number] = [0.5, 0.44, 0.52];

/**
 * Stepped, softly colored rock under the island (below y = 0). Only exposed faces are emitted.
 * Colors fade from warm earth at the top to a soft lilac at the tip.
 */
export function buildUnderside(mask: Uint8Array, maxDepth: number): UndersideArrays {
  const depths = columnDepths(mask, maxDepth);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const total = Math.max(1, maxDepth + 1);
  const colorAt = (y: number, x: number, z: number): number[] => {
    const t = Math.min(1, -y / total);
    const n = 0.92 + hash2(x * 3.1, z * 1.7) * 0.12;
    return ROCK_TOP.map((c, k) => (c + (ROCK_BOTTOM[k] - c) * t) * n);
  };
  const quad = (corners: number[][], normal: number[], x: number, z: number): void => {
    const base = positions.length / 3;
    for (const c of corners) {
      positions.push(c[0], c[1], c[2]);
      normals.push(normal[0], normal[1], normal[2]);
      colors.push(...colorAt(c[1], x, z));
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const depthAt = (x: number, z: number): number =>
    x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z ? 0 : depths[x + z * SIZE_X];

  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const d = depthAt(x, z);
      if (d <= 0) continue;
      const b = -d;
      quad([[x, b, z], [x + 1, b, z], [x + 1, b, z + 1], [x, b, z + 1]], [0, -1, 0], x, z);
      const sides: [number, number, number[][], number[]][] = [
        [1, 0, [[x + 1, 0, z + 1], [x + 1, 0, z], [x + 1, 0, z], [x + 1, 0, z + 1]], [1, 0, 0]],
        [-1, 0, [[x, 0, z], [x, 0, z + 1], [x, 0, z + 1], [x, 0, z]], [-1, 0, 0]],
        [0, 1, [[x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z + 1], [x, 0, z + 1]], [0, 0, 1]],
        [0, -1, [[x + 1, 0, z], [x, 0, z], [x, 0, z], [x + 1, 0, z]], [0, 0, -1]],
      ];
      for (const [dx, dz, c, normal] of sides) {
        const nd = depthAt(x + dx, z + dz);
        if (nd >= d) continue;
        // Wall from the neighbor's bottom (-nd) down to ours (-d); corners: bottom-left, bottom-right, top-right, top-left.
        quad([[c[0][0], -d, c[0][2]], [c[1][0], -d, c[1][2]], [c[2][0], -nd, c[2][2]], [c[3][0], -nd, c[3][2]]], normal, x, z);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}
