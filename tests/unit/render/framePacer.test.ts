import { describe, expect, it } from 'vitest';
import { FramePacer, KICK_MS } from '../../../src/render/framePacer';

const FRAME = 1000 / 60;

/** Simulates a 60 Hz display; returns how many frames rendered and how many were measured. */
function run(pacer: FramePacer, from: number, frames: number, animating: boolean) {
  let rendered = 0;
  let measured = 0;
  for (let i = 0; i < frames; i++) {
    const r = pacer.next(from + i * FRAME, animating);
    if (r) rendered += 1;
    if (r?.measure) measured += 1;
  }
  return { rendered, measured };
}

describe('frame pacer', () => {
  it('renders every frame while animating', () => {
    expect(run(new FramePacer(), 0, 60, true)).toEqual({ rendered: 60, measured: 59 });
  });

  it('drops to about 30 fps when only the clouds move', () => {
    const { rendered, measured } = run(new FramePacer(), 0, 60, false);
    expect(rendered).toBe(30);
    expect(measured).toBe(0); // Throttled frames never count as a slow device.
  });

  it('runs at full rate for a while after a kick', () => {
    const pacer = new FramePacer();
    run(pacer, 0, 30, false);
    const t = 30 * FRAME;
    pacer.kick(t);
    const kickFrames = Math.floor(KICK_MS / FRAME);
    const busy = run(pacer, t, kickFrames, false);
    expect(busy.rendered).toBe(kickFrames);
    expect(busy.measured).toBe(kickFrames - 1); // Not the first frame after an idle gap.
  });
});
