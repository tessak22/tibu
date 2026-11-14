import { describe, expect, it } from 'vitest';
import { GestureTracker } from '../../../src/input/gestures';
import { shouldRejectPointer } from '../../../src/input/palm';

const view = { width: 1000, height: 700 };
const touch = (id: number, x: number, y: number, extra: Partial<{ width: number; height: number }> = {}) => ({
  id,
  x,
  y,
  pointerType: 'touch',
  ...extra,
});
const types = (events: { type: string }[]) => events.map((e) => e.type);

describe('GestureTracker', () => {
  it('press then lift is a tap', () => {
    const g = new GestureTracker(() => view);
    expect(types(g.down(touch(1, 100, 100)))).toEqual(['press']);
    expect(g.move(touch(1, 104, 103))).toEqual([]);
    expect(g.up(touch(1, 104, 103))).toEqual([{ type: 'tap', x: 104, y: 103 }]);
  });

  it('moving past the threshold becomes an orbit and never taps', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 100, 100));
    expect(types(g.move(touch(1, 125, 100)))).toEqual(['pressCancel', 'orbit']);
    expect(g.move(touch(1, 130, 90))).toEqual([{ type: 'orbit', dx: 5, dy: -10 }]);
    g.move(touch(1, 100, 100));
    expect(g.up(touch(1, 100, 100))).toEqual([]);
  });

  it('two fingers pinch and never tap', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 400, 300));
    expect(types(g.down(touch(2, 500, 300)))).toEqual(['pressCancel']);
    const [pinch] = g.move(touch(2, 600, 300));
    expect(pinch).toEqual({ type: 'pinch', scale: 2 });
    expect(g.up(touch(2, 600, 300))).toEqual([]);
    expect(g.move(touch(1, 450, 300))).toEqual([]);
    expect(g.up(touch(1, 450, 300))).toEqual([]);
  });

  it('two fingers moving together pan', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 400, 300));
    g.down(touch(2, 500, 300));
    expect(g.move(touch(1, 420, 330))).toEqual([
      { type: 'pinch', scale: Math.hypot(80, 30) / 100 },
      { type: 'pan', dx: 10, dy: 15 },
    ]);
    expect(g.move(touch(2, 520, 330))).toContainEqual({ type: 'pan', dx: 10, dy: 15 });
  });

  it('cancel never taps', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 100, 100));
    expect(types(g.cancel(1))).toEqual(['pressCancel']);
    expect(g.up(touch(1, 100, 100))).toEqual([]);
  });

  it('never ignores a single touch because of its size (adult fingertips)', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 500, 300, { width: 120, height: 120 }));
    expect(g.up(touch(1, 500, 300))).toEqual([{ type: 'tap', x: 500, y: 300 }]);
  });

  it('treats a small wobble during a tap as a tap', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 500, 300));
    g.move(touch(1, 512, 308));
    expect(g.up(touch(1, 512, 308))).toEqual([{ type: 'tap', x: 512, y: 308 }]);
  });

  it('ignores a palm-sized contact while another finger is down', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 500, 300));
    expect(g.down(touch(2, 600, 300, { width: 220, height: 220 }))).toEqual([]);
    expect(g.up(touch(2, 600, 300))).toEqual([]);
  });

  it('ignores an edge touch while another finger is active', () => {
    const g = new GestureTracker(() => view);
    g.down(touch(1, 500, 300));
    expect(g.down(touch(2, 5, 300))).toEqual([]);
    expect(g.move(touch(2, 50, 300))).toEqual([]);
    expect(g.up(touch(2, 50, 300))).toEqual([]);
    expect(g.up(touch(1, 500, 300))).toEqual([{ type: 'tap', x: 500, y: 300 }]);
  });
});

describe('shouldRejectPointer', () => {
  it('accepts a lone edge touch and mouse input', () => {
    expect(shouldRejectPointer({ x: 5, y: 5, pointerType: 'touch' }, view, 0)).toBe(false);
    expect(shouldRejectPointer({ x: 5, y: 5, width: 200, pointerType: 'mouse' }, view, 1)).toBe(false);
  });
  it('rejects near-edge touches when a touch is already active', () => {
    expect(shouldRejectPointer({ x: 990, y: 300, pointerType: 'touch' }, view, 1)).toBe(true);
  });
});
