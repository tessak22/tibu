import { describe, expect, it, vi } from 'vitest';
import { BIG_WORLD_SIZE, type WorldAction, type WorldModel } from '../../../src/core/types';
import { createSeedableWorld, createWorld } from '../../../src/world';

const c = (x: number, y: number, z: number) => ({ x, y, z });

/** A world with a 5x5 floor at y=0 around (5, 5). */
function withFloor(): WorldModel {
  const w = createWorld('meadow');
  for (let x = 3; x <= 7; x++) for (let z = 3; z <= 7; z++) w.place(c(x, 0, z), 'nature:grass');
  return w;
}

const batchSize = (a: WorldAction | null): number => (a?.type === 'batch' ? a.actions.length : a ? 1 : 0);

describe('smash with topple', () => {
  it('topples a tower when its bottom block is smashed', () => {
    const w = withFloor();
    for (let y = 1; y <= 5; y++) w.place(c(5, y, 5), 'colors:red');
    const action = w.smash(c(5, 1, 5), { topple: true });
    expect(action?.type).toBe('batch');
    if (action?.type !== 'batch') return;
    expect(action.reason).toBe('collapse');
    expect(action.actions).toHaveLength(5);
    expect(action.actions[0]).toEqual({ type: 'remove', cell: c(5, 1, 5), block: 'colors:red' });
    for (let y = 1; y <= 5; y++) expect(w.get(c(5, y, 5))).toBeNull();
    expect(w.get(c(5, 0, 5))).toBe('nature:grass');
  });

  it('without topple only the tapped block goes', () => {
    const w = withFloor();
    for (let y = 1; y <= 3; y++) w.place(c(5, y, 5), 'colors:red');
    expect(w.smash(c(5, 1, 5), { topple: false })).toEqual({ type: 'remove', cell: c(5, 1, 5), block: 'colors:red' });
    expect(w.get(c(5, 3, 5))).toBe('colors:red');
  });

  it('smashing the top of a tower is a plain remove', () => {
    const w = withFloor();
    for (let y = 1; y <= 3; y++) w.place(c(5, y, 5), 'colors:red');
    expect(w.smash(c(5, 3, 5), { topple: true })?.type).toBe('remove');
  });

  it('an arch with two legs survives losing one leg', () => {
    const w = withFloor();
    // legs at x=3 and x=7, span at y=3 from x=3..7
    for (let y = 1; y <= 3; y++) {
      w.place(c(3, y, 5), 'colors:red');
      w.place(c(7, y, 5), 'colors:red');
    }
    for (let x = 4; x <= 6; x++) w.place(c(x, 3, 5), 'colors:blue');
    const action = w.smash(c(3, 1, 5), { topple: true });
    expect(action?.type).toBe('remove');
    expect(w.count()).toBe(25 + 8);
    expect(w.get(c(3, 3, 5))).toBe('colors:red');
  });

  it('an L-shape topples correctly (overhang falls, other towers stay)', () => {
    const w = withFloor();
    for (let y = 1; y <= 4; y++) w.place(c(4, y, 4), 'colors:red'); // upright
    for (let x = 5; x <= 7; x++) w.place(c(x, 4, 4), 'colors:green'); // arm, hanging in the air
    w.place(c(6, 1, 6), 'colors:blue'); // unrelated small tower
    const action = w.smash(c(4, 2, 4), { topple: true });
    expect(batchSize(action)).toBe(1 + 2 + 3);
    expect(w.get(c(4, 1, 4))).toBe('colors:red'); // below the smash stays
    for (let x = 5; x <= 7; x++) expect(w.get(c(x, 4, 4))).toBeNull();
    expect(w.get(c(6, 1, 6))).toBe('colors:blue');
  });

  it('one undo restores everything, with rotations, as one change', () => {
    const w = withFloor();
    for (let y = 1; y <= 4; y++) w.place(c(5, y, 5), 'parts:slope', ((y % 4) as 0 | 1 | 2 | 3));
    const before = w.serialize();
    const spy = vi.fn();
    w.onChange(spy);
    const action = w.smash(c(5, 1, 5), { topple: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(action);
    const inverse = w.undo();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(inverse?.type).toBe('batch');
    expect(spy.mock.calls[1][1]).toBe('undo');
    expect(w.serialize()).toEqual(before);
    expect(w.getRotation(c(5, 3, 5))).toBe(3);
  });

  it('a batch counts as one of the 50 undo steps', () => {
    const w = withFloor(); // 25 actions
    for (let y = 1; y <= 5; y++) w.place(c(5, y, 5), 'colors:red'); // 30
    w.smash(c(5, 1, 5), { topple: true }); // 31: one batch of 5
    for (let i = 0; i < 19; i++) w.place(c(i % 10, 10, Math.floor(i / 10)), 'colors:blue'); // 50
    let undone = 0;
    while (w.undo()) undone++;
    expect(undone).toBe(50);
    expect(w.count()).toBe(0); // the batch undo restored the tower, earlier undos removed it again
  });

  it('drops the oldest steps past 50, a batch being one step', () => {
    const w = withFloor();
    for (let y = 1; y <= 5; y++) w.place(c(5, y, 5), 'colors:red');
    w.smash(c(5, 1, 5), { topple: true });
    for (let i = 0; i < 49; i++) w.place(c(i % 10, 10, Math.floor(i / 10)), 'colors:blue');
    let undone = 0;
    while (w.undo()) undone++;
    expect(undone).toBe(50);
    for (let y = 1; y <= 5; y++) expect(w.get(c(5, y, 5))).toBe('colors:red'); // batch was the oldest kept step
  });

  it('keeps already-floating sculptures when one of their blocks is smashed', () => {
    const w = withFloor();
    for (let x = 3; x <= 7; x++) w.place(c(x, 8, 5), 'colors:red'); // floating bar, never supported
    expect(w.smash(c(5, 8, 5), { topple: true })?.type).toBe('remove');
    expect(w.get(c(3, 8, 5))).toBe('colors:red');
    expect(w.get(c(7, 8, 5))).toBe('colors:red');
  });

  it('a floating block attached to a falling tower falls with it, other floaters stay', () => {
    const w = withFloor();
    for (let y = 1; y <= 3; y++) w.place(c(4, y, 4), 'colors:red');
    w.place(c(5, 3, 4), 'colors:green'); // hangs off the tower
    w.place(c(7, 6, 7), 'colors:blue'); // unrelated floater
    expect(batchSize(w.smash(c(4, 1, 4), { topple: true }))).toBe(4);
    expect(w.get(c(7, 6, 7))).toBe('colors:blue');
  });

  it('never smashes the floor and ignores empty cells', () => {
    const w = withFloor();
    expect(w.smash(c(5, 0, 5), { topple: true })).toBeNull();
    expect(w.smash(c(5, 4, 5), { topple: true })).toBeNull();
    expect(w.smash(c(-1, 4, 5), { topple: true })).toBeNull();
  });

  it('stays fast on a full-height 96x32x96 world', () => {
    const { model, seed } = createSeedableWorld('meadow', { size: BIG_WORLD_SIZE });
    for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y < 4; y++) seed(c(x, y, z), 'nature:dirt');
    for (let x = 10; x < 60; x++) for (let y = 4; y < 31; y++) seed(c(x, y, 40), 'colors:red'); // big wall
    const t0 = performance.now();
    for (let x = 10; x < 60; x += 5) model.smash(c(x, 4, 40), { topple: true });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(model.get(c(30, 30, 40))).toBe('colors:red');
  });
});
