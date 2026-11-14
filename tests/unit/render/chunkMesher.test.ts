import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE, WORLD_SIZE, type BlockShape } from '../../../src/core/types';
import { ChunkLayout } from '../../../src/render/chunkMath';
import { AO_LEVELS, meshChunk, vertexAo, type MesherInput } from '../../../src/render/chunkMesher';
import { shapeTemplate } from '../../../src/render/shapes';
import { cellKey } from '../../../src/render/voxelGrid';

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
    const { solid } = meshChunk(input({ '1,1,1': 1, '2,1,1': 1 }, { hidden: new Set([cellKey(WORLD_SIZE, 2, 1, 1)]) }));
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

describe('meshChunk with parts', () => {
  const shapes = (id: number): BlockShape => (id === 5 ? 'slope' : id === 6 ? 'pane' : 'cube');

  it('parts never hide their neighbours faces', () => {
    const { solid } = meshChunk(input({ '1,1,1': 1, '2,1,1': 5 }, { shapeOf: shapes }));
    const cubeQuads = 6; // The cube keeps its face towards the slope.
    const slope = shapeTemplate('slope', 0);
    expect(solid.indices.length).toBe(cubeQuads * 6 + slope.indices.length);
  });

  it('puts panes in the translucent glass mesh, rotated', () => {
    const { solid, glass } = meshChunk(
      input({ '1,1,1': 6 }, { shapeOf: shapes, rotAt: () => 1, isTranslucent: (id) => id === 6 }),
    );
    expect(solid.indices.length).toBe(0);
    expect(glass.indices.length).toBe(shapeTemplate('pane', 1).indices.length);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < glass.positions.length; i += 3) {
      minX = Math.min(minX, glass.positions[i]);
      maxX = Math.max(maxX, glass.positions[i]);
    }
    // A quarter turn makes the thin panel run along z, so it is thin along x.
    expect(maxX - minX).toBeLessThan(0.2);
  });

  it('keeps opaque panes (e.g. a flag) in the solid mesh', () => {
    const { solid, glass } = meshChunk(input({ '1,1,1': 6 }, { shapeOf: shapes }));
    expect(glass.indices.length).toBe(0);
    expect(solid.indices.length).toBe(shapeTemplate('pane', 0).indices.length);
  });

  it('meshes big-world chunks with their own width and height', () => {
    const layout = new ChunkLayout(BIG_WORLD_SIZE);
    const { solid } = meshChunk(
      input({ '20,31,20': 1, '40,3,40': 1 }, { origin: layout.origin(layout.indexOf(20, 20)), size: BIG_WORLD_SIZE, width: layout.width }),
    );
    expect(quads(solid.indices)).toBe(6);
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

describe('chunk layout', () => {
  it('maps little-world cells to 3x3 chunk columns', () => {
    const l = new ChunkLayout(WORLD_SIZE);
    expect(l.count).toBe(9);
    expect(l.indexOf(0, 0)).toBe(0);
    expect(l.indexOf(23, 23)).toBe(8);
    expect(l.origin(4)).toEqual({ x: 8, y: 0, z: 8 });
    expect(l.height).toBe(16);
  });

  it('marks neighbour chunks when a boundary cell changes', () => {
    const l = new ChunkLayout(WORLD_SIZE);
    expect(l.affectedBy({ x: 3, y: 5, z: 3 })).toEqual([0]);
    expect(l.affectedBy({ x: 7, y: 5, z: 3 })).toEqual([0, 1]);
    expect(l.affectedBy({ x: 8, y: 0, z: 8 })).toEqual([0, 1, 3, 4]);
    expect(l.affectedBy({ x: 0, y: 0, z: 0 })).toEqual([0]);
  });

  it('uses wide, full-height columns in big worlds', () => {
    const l = new ChunkLayout(BIG_WORLD_SIZE);
    expect(l.width).toBe(16);
    expect(l.count).toBe(36);
    expect(l.height).toBe(32);
    expect(l.indexOf(95, 95)).toBe(35);
    expect(l.affectedBy({ x: 95, y: 0, z: 95 })).toEqual([35]);
  });
});
