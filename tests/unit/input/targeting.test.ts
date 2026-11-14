import { describe, expect, it } from 'vitest';
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
});
