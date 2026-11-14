import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE } from '../../../src/core/types';
import { resolveTapTarget } from '../../../src/input/targeting';

const solid = (cells: string[]) => {
  const set = new Set(cells);
  return (x: number, y: number, z: number) => set.has(`${x},${y},${z}`);
};
const down = { origin: { x: 4.5, y: 30, z: 4.5 }, dir: { x: 0, y: -1, z: 0 } };

describe('resolveTapTarget', () => {
  it('build mode targets the cell above a tapped top face', () => {
    const t = resolveTapTarget({ ...down, mode: 'build', isSolid: solid(['4,0,4']), floorEmpty: false });
    expect(t).toEqual({ kind: 'place', cell: { x: 4, y: 1, z: 4 }, tapped: { x: 4, y: 0, z: 4 } });
  });

  it('build mode at the ceiling only touches the block', () => {
    const t = resolveTapTarget({ ...down, mode: 'build', isSolid: solid(['4,15,4']), floorEmpty: false });
    expect(t).toEqual({ kind: 'touch', tapped: { x: 4, y: 15, z: 4 } });
  });

  it('smash mode targets the hit block', () => {
    const t = resolveTapTarget({ ...down, mode: 'smash', isSolid: solid(['4,3,4']), floorEmpty: false });
    expect(t).toEqual({ kind: 'smash', cell: { x: 4, y: 3, z: 4 } });
  });

  it('sky taps resolve to nothing', () => {
    expect(resolveTapTarget({ ...down, mode: 'build', isSolid: () => false, floorEmpty: false })).toBeNull();
    expect(resolveTapTarget({ ...down, mode: 'smash', isSolid: () => false, floorEmpty: true })).toBeNull();
  });

  it('an empty world lets you build on the floor plane', () => {
    const t = resolveTapTarget({ ...down, mode: 'build', isSolid: () => false, floorEmpty: true });
    expect(t).toEqual({ kind: 'place', cell: { x: 4, y: 0, z: 4 }, tapped: null });
  });

  it('works on the far side of a big world', () => {
    const t = resolveTapTarget({
      origin: { x: 90.5, y: 40, z: 90.5 },
      dir: { x: 0, y: -1, z: 0 },
      mode: 'build',
      isSolid: solid(['90,25,90']),
      floorEmpty: false,
      size: BIG_WORLD_SIZE,
    });
    expect(t).toEqual({ kind: 'place', cell: { x: 90, y: 26, z: 90 }, tapped: { x: 90, y: 25, z: 90 } });
  });
});

describe('resolveTapTarget with ghosts', () => {
  const ghosts = (cells: string[]) => solid(cells);
  const side = { origin: { x: -5, y: 1.5, z: 4.5 }, dir: { x: 1, y: 0, z: 0 } };

  it('a ghost cell is a target even with nothing behind it', () => {
    const t = resolveTapTarget({ ...side, mode: 'build', isSolid: () => false, floorEmpty: false, isGhost: ghosts(['3,1,4']) });
    expect(t).toEqual({ kind: 'ghost', cell: { x: 3, y: 1, z: 4 } });
  });

  it('the nearest of block and ghost wins', () => {
    const nearGhost = resolveTapTarget({ ...side, mode: 'build', isSolid: solid(['6,1,4']), floorEmpty: false, isGhost: ghosts(['3,1,4']) });
    expect(nearGhost).toEqual({ kind: 'ghost', cell: { x: 3, y: 1, z: 4 } });
    const nearBlock = resolveTapTarget({ ...side, mode: 'build', isSolid: solid(['2,1,4']), floorEmpty: false, isGhost: ghosts(['3,1,4']) });
    expect(nearBlock).toEqual({ kind: 'place', cell: { x: 1, y: 1, z: 4 }, tapped: { x: 2, y: 1, z: 4 } });
  });

  it('an already built ghost cell counts as a block', () => {
    const t = resolveTapTarget({ ...down, mode: 'build', isSolid: solid(['4,1,4']), floorEmpty: false, isGhost: ghosts(['4,1,4']) });
    expect(t).toEqual({ kind: 'place', cell: { x: 4, y: 2, z: 4 }, tapped: { x: 4, y: 1, z: 4 } });
  });

  it('smash mode ignores ghosts', () => {
    expect(resolveTapTarget({ ...side, mode: 'smash', isSolid: () => false, floorEmpty: false, isGhost: ghosts(['3,1,4']) })).toBeNull();
  });
});
