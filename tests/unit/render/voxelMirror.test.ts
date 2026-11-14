import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE, type WorldAction } from '../../../src/core/types';
import { RenderGrid } from '../../../src/render/voxelGrid';
import { flattenAction, VoxelMirror } from '../../../src/render/voxelMirror';

describe('render grid', () => {
  it('stores blocks and rotations for big worlds', () => {
    const g = new RenderGrid(BIG_WORLD_SIZE);
    expect(g.set(95, 31, 95, 'a:b', 3)).toBe(true);
    expect(g.get(95, 31, 95)).toBe('a:b');
    expect(g.rotAt(95, 31, 95)).toBe(3);
    expect(g.set(96, 0, 0, 'a:b')).toBe(false);
    expect([...g.entries()]).toEqual([[{ x: 95, y: 31, z: 95 }, 'a:b']]);
  });
});

describe('voxel mirror', () => {
  it('applies collapse batches (and nested batches) cell by cell', () => {
    const m = new VoxelMirror();
    m.apply({ type: 'place', cell: { x: 1, y: 1, z: 1 }, block: 'a:b', rot: 2 });
    m.apply({ type: 'place', cell: { x: 1, y: 2, z: 1 }, block: 'a:c' });
    expect(m.rotation({ x: 1, y: 1, z: 1 })).toBe(2);
    const batch: WorldAction = {
      type: 'batch',
      reason: 'collapse',
      actions: [
        { type: 'remove', cell: { x: 1, y: 1, z: 1 }, block: 'a:b', rot: 2 },
        { type: 'batch', reason: 'collapse', actions: [{ type: 'remove', cell: { x: 1, y: 2, z: 1 }, block: 'a:c' }] },
      ],
    };
    expect(flattenAction(batch)).toHaveLength(2);
    expect(m.apply(batch).map((c) => c.type)).toEqual(['remove', 'remove']);
    expect(m.isSolid(1, 1, 1)).toBe(false);
    expect(m.isSolid(1, 2, 1)).toBe(false);
  });
});
