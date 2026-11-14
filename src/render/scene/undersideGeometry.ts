/** Footprint of the mask: columns along x and z. Defaults to the little-builder island. */
export interface MaskSize {
  readonly x: number;
  readonly z: number;
}
const DEFAULT_MASK: MaskSize = { x: 24, z: 24 };
const EDGE_CAP = 12;

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

/**
 * Distance (in cells, capped) from each ground column to the nearest non-ground column.
 * Two-pass chamfer transform: linear time, so big worlds stay cheap to load.
 */
function edgeDistance(mask: Uint8Array, size: MaskSize): Float32Array {
  const { x: sx, z: sz } = size;
  const dist = new Float32Array(sx * sz);
  const D = Math.SQRT2;
  const at = (x: number, z: number): number => (x < 0 || z < 0 || x >= sx || z >= sz ? 0 : dist[x + z * sx]);
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] ? EDGE_CAP : 0;
  for (let z = 0; z < sz; z++) {
    for (let x = 0; x < sx; x++) {
      const i = x + z * sx;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, z) + 1, at(x, z - 1) + 1, at(x - 1, z - 1) + D, at(x + 1, z - 1) + D);
    }
  }
  for (let z = sz - 1; z >= 0; z--) {
    for (let x = sx - 1; x >= 0; x--) {
      const i = x + z * sx;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, z) + 1, at(x, z + 1) + 1, at(x + 1, z + 1) + D, at(x - 1, z + 1) + D);
    }
  }
  return dist;
}

/** Depth (in blocks) of the rock under each column: deep in the middle, shallow at the rim. */
export function columnDepths(mask: Uint8Array, maxDepth: number, size: MaskSize = DEFAULT_MASK): Float32Array {
  const depth = Math.max(1, Math.min(32, Math.floor(maxDepth) || 1));
  const dist = edgeDistance(mask, size);
  let maxDist = 1;
  for (const d of dist) maxDist = Math.max(maxDist, d);
  const out = new Float32Array(size.x * size.z);
  for (let i = 0; i < out.length; i++) {
    if (!mask[i]) continue;
    const t = Math.min(1, dist[i] / maxDist);
    const x = i % size.x;
    const z = Math.floor(i / size.x);
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
export function buildUnderside(mask: Uint8Array, maxDepth: number, size: MaskSize = DEFAULT_MASK): UndersideArrays {
  const depths = columnDepths(mask, maxDepth, size);
  const { x: sx, z: sz } = size;
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
    x < 0 || z < 0 || x >= sx || z >= sz ? 0 : depths[x + z * sx];

  for (let z = 0; z < sz; z++) {
    for (let x = 0; x < sx; x++) {
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
