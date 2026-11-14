import { describe, expect, it } from 'vitest';
import { adjacentCell, raycastFloorPlane, raycastVoxels } from '../../../src/input/voxelRaycast';

const solidSet = (cells: string[]) => {
  const set = new Set(cells);
  return (x: number, y: number, z: number) => set.has(`${x},${y},${z}`);
};

describe('raycastVoxels', () => {
  it('hits the top face of a block from above', () => {
    const hit = raycastVoxels({ x: 5.5, y: 30, z: 5.5 }, { x: 0, y: -1, z: 0 }, solidSet(['5,2,5']));
    expect(hit?.cell).toEqual({ x: 5, y: 2, z: 5 });
    expect(hit?.normal).toEqual({ x: 0, y: 1, z: 0 });
    expect(adjacentCell(hit!)).toEqual({ x: 5, y: 3, z: 5 });
  });

  it('hits a side face', () => {
    const hit = raycastVoxels({ x: -10, y: 3.5, z: 4.5 }, { x: 1, y: 0, z: 0 }, solidSet(['7,3,4']));
    expect(hit?.cell).toEqual({ x: 7, y: 3, z: 4 });
    expect(hit?.normal).toEqual({ x: -1, y: 0, z: 0 });
    expect(adjacentCell(hit!)).toEqual({ x: 6, y: 3, z: 4 });
  });

  it('reports the entry face of a diagonal ray', () => {
    const hit = raycastVoxels({ x: 30, y: 20, z: 30 }, { x: -1, y: -1.1, z: -1 }, (_x, y) => y === 0);
    expect(hit?.cell.y).toBe(0);
    expect(hit?.normal).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('hits the grid boundary face when the first cell is solid', () => {
    const hit = raycastVoxels({ x: 12.5, y: 0.5, z: -5 }, { x: 0, y: 0, z: 1 }, solidSet(['12,0,0']));
    expect(hit?.normal).toEqual({ x: 0, y: 0, z: -1 });
  });

  it('returns null for empty space and rays that miss the grid', () => {
    expect(raycastVoxels({ x: 5, y: 30, z: 5 }, { x: 0, y: 1, z: 0 }, () => true)).toBeNull();
    expect(raycastVoxels({ x: 5, y: 30, z: 5 }, { x: 0, y: -1, z: 0 }, () => false)).toBeNull();
    expect(raycastVoxels({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 }, () => true)).toBeNull();
  });

  it('works from inside the grid', () => {
    const hit = raycastVoxels({ x: 12.5, y: 8.5, z: 12.5 }, { x: 0, y: -1, z: 0 }, solidSet(['12,1,12']));
    expect(hit?.cell).toEqual({ x: 12, y: 1, z: 12 });
    expect(hit?.normal).toEqual({ x: 0, y: 1, z: 0 });
  });
});

describe('raycastFloorPlane', () => {
  it('finds the floor cell below', () => {
    expect(raycastFloorPlane({ x: 3.2, y: 10, z: 4.7 }, { x: 0, y: -1, z: 0 })).toEqual({ x: 3, y: 0, z: 4 });
  });
  it('ignores upward rays and points outside', () => {
    expect(raycastFloorPlane({ x: 3, y: 10, z: 4 }, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(raycastFloorPlane({ x: -30, y: 10, z: 4 }, { x: 0, y: -1, z: 0 })).toBeNull();
  });
});
