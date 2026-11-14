import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE } from '../../../src/core/types';
import { resolveTapTarget } from '../../../src/input/targeting';
import { isStandable, walkTargetFor } from '../../../src/input/walkTarget';

const solid = (cells: string[]) => {
  const set = new Set(cells);
  return (x: number, y: number, z: number) => set.has(`${x},${y},${z}`);
};
const floor = (extra: string[] = []) => {
  const cells = [...extra];
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) cells.push(`${x},0,${z}`);
  return solid(cells);
};
const size = BIG_WORLD_SIZE;

describe('walk tap target', () => {
  it('a top face sends the character to the empty cell above', () => {
    const t = resolveTapTarget({ origin: { x: 4.5, y: 30, z: 4.5 }, dir: { x: 0, y: -1, z: 0 }, mode: 'walk', isSolid: floor(), floorEmpty: false, size });
    expect(t).toEqual({ kind: 'walk', cell: { x: 4, y: 1, z: 4 }, tapped: { x: 4, y: 0, z: 4 } });
  });

  it('a side face of a short step targets the top of that column', () => {
    const isSolid = floor(['5,1,5']);
    const hit = { cell: { x: 5, y: 1, z: 5 }, normal: { x: -1, y: 0, z: 0 }, distance: 1 };
    expect(walkTargetFor(hit, isSolid, size)).toEqual({ x: 5, y: 2, z: 5 });
  });

  it('a side face of a tall wall targets the ground next to it', () => {
    const isSolid = floor(['5,1,5', '5,2,5', '5,3,5', '5,4,5']);
    const hit = { cell: { x: 5, y: 3, z: 5 }, normal: { x: -1, y: 0, z: 0 }, distance: 1 };
    expect(walkTargetFor(hit, isSolid, size)).toEqual({ x: 4, y: 1, z: 5 });
  });

  it('needs headroom and something to stand on', () => {
    const isSolid = floor(['3,2,3']);
    expect(isStandable({ x: 3, y: 1, z: 3 }, isSolid, size)).toBe(false); // Head bumps.
    expect(isStandable({ x: 4, y: 1, z: 4 }, isSolid, size)).toBe(true);
    expect(isStandable({ x: 40, y: 1, z: 40 }, isSolid, size)).toBe(false); // Over the void.
    const hit = { cell: { x: 3, y: 0, z: 3 }, normal: { x: 0, y: 1, z: 0 }, distance: 1 };
    expect(walkTargetFor(hit, isSolid, size)).toBeNull();
  });

  it('never targets anything in the sky', () => {
    expect(resolveTapTarget({ origin: { x: 50, y: 30, z: 50 }, dir: { x: 0, y: -1, z: 0 }, mode: 'walk', isSolid: floor(), floorEmpty: true, size })).toBeNull();
  });
});
