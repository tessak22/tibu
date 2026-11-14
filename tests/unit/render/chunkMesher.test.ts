import { describe, expect, it } from 'vitest';
import { chunkIndexOf, chunkOrigin, chunksAffectedBy, CHUNK_COUNT } from '../../../src/render/chunkMath';
import { AO_LEVELS, meshChunk, vertexAo, type MesherInput } from '../../../src/render/chunkMesher';
import { cellIndex } from '../../../src/world/grid';

function input(cells: Record<string, number>, extra: Partial<MesherInput> = {}): MesherInput {
  return {
    idAt: (x, y, z) => cells[`${x},${y},${z}`] ?? 0,
    origin: { x: 0, y: 0, z: 0 },
    uvRect: () => [0, 0, 1, 1],
    isGlow: (id) => id === 9,
    ...extra,
  };
}
const quads = (indices: Uint32Array) => indices.length / 6;

describe('meshChunk', () => {
  it('emits six faces for a lone block', () => {
    const { solid, glow } = meshChunk(input({ '1,1,1': 1 }));
    expect(quads(solid.indices)).toBe(6);
    expect(solid.positions.length).toBe(6 * 4 * 3);
    expect(quads(glow.indices)).toBe(0);
  });

  it('hides internal faces between neighbours', () => {
    const { solid } = meshChunk(input({ '1,1,1': 1, '2,1,1': 1 }));
    expect(quads(solid.indices)).toBe(10);
  });

  it('puts glowing blocks in the glow mesh', () => {
    const { solid, glow } = meshChunk(input({ '1,1,1': 9 }));
    expect(quads(solid.indices)).toBe(0);
    expect(quads(glow.indices)).toBe(6);
  });

  it('only meshes cells inside its chunk but culls against neighbours outside', () => {
    const { solid } = meshChunk(input({ '7,0,0': 1, '8,0,0': 1 }));
    expect(quads(solid.indices)).toBe(5);
  });

  it('treats hidden cells as empty', () => {
    const { solid } = meshChunk(input({ '1,1,1': 1, '2,1,1': 1 }, { hidden: new Set([cellIndex(2, 1, 1)]) }));
    expect(quads(solid.indices)).toBe(6);
  });

  it('darkens corners next to other blocks (ambient occlusion)', () => {
    const { solid } = meshChunk(input({ '1,0,1': 1, '2,1,1': 1 }));
    expect(Math.min(...solid.colors)).toBeLessThan(1);
    expect(Math.max(...solid.colors)).toBe(1);
  });

  it('faces point outward (CCW winding matches normals)', () => {
    const { solid } = meshChunk(input({ '3,3,3': 1 }));
    const p = solid.positions;
    for (let q = 0; q < solid.indices.length; q += 3) {
      const [a, b, c] = [solid.indices[q], solid.indices[q + 1], solid.indices[q + 2]];
      const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
      const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
      const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const n = [solid.normals[a * 3], solid.normals[a * 3 + 1], solid.normals[a * 3 + 2]];
      expect(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]).toBeGreaterThan(0);
    }
  });
});

describe('vertexAo', () => {
  it('follows the classic voxel AO rule', () => {
    expect(vertexAo(true, true, false)).toBe(0);
    expect(vertexAo(false, false, false)).toBe(3);
    expect(vertexAo(true, false, true)).toBe(1);
    expect(AO_LEVELS[3]).toBe(1);
  });
});

describe('chunk math', () => {
  it('maps cells to 3x3 chunk columns', () => {
    expect(CHUNK_COUNT).toBe(9);
    expect(chunkIndexOf(0, 0)).toBe(0);
    expect(chunkIndexOf(23, 23)).toBe(8);
    expect(chunkOrigin(4)).toEqual({ x: 8, y: 0, z: 8 });
  });

  it('marks neighbour chunks when a boundary cell changes', () => {
    expect(chunksAffectedBy({ x: 3, y: 5, z: 3 })).toEqual([0]);
    expect(chunksAffectedBy({ x: 7, y: 5, z: 3 })).toEqual([0, 1]);
    expect(chunksAffectedBy({ x: 8, y: 0, z: 8 })).toEqual([0, 1, 3, 4]);
    expect(chunksAffectedBy({ x: 0, y: 0, z: 0 })).toEqual([0]);
  });
});
