import { describe, expect, it } from 'vitest';
import {
  advanceTumble,
  MAX_EXTRA_PUFFS,
  MAX_REDUCED_PUFFS,
  MAX_TUMBLERS,
  planCollapse,
  startTumble,
  TUMBLE_SECONDS,
  type FallenBlock,
} from '../../../src/render/effects/collapsePlan';

const tower = (height: number, x = 5, z = 5): FallenBlock[] =>
  Array.from({ length: height }, (_, i) => ({ cell: { x, y: 1 + i, z }, block: 'colors:red', rot: 0 as const }));

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('planCollapse', () => {
  it('pops the smashed block and tumbles the rest outward', () => {
    const fallen = [...tower(4), { cell: { x: 6, y: 2, z: 5 }, block: 'colors:blue', rot: 0 as const }];
    const plan = planCollapse({ origin: { x: 5, y: 1, z: 5 }, fallen, groundAt: () => 1, reducedMotion: false, random: seeded() });
    expect(plan.puffs.map((p) => p.cell)).toEqual([{ x: 5, y: 1, z: 5 }]);
    expect(plan.tumblers).toHaveLength(4);
    const side = plan.tumblers.find((t) => t.cell.x === 6)!;
    expect(side.velocity.x).toBeGreaterThan(0); // Pushed away from the smash.
    expect(side.spin.z).toBeLessThan(0); // Tips over outward.
    // Nearest blocks go first.
    const delays = plan.tumblers.map((t) => t.delay);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    for (const t of plan.tumblers) expect(t.groundY).toBe(1);
  });

  it('caps the number of tumbling blocks and extra puffs', () => {
    const plan = planCollapse({ origin: { x: 5, y: 1, z: 5 }, fallen: tower(15).concat(tower(15, 6, 5), tower(15, 7, 5)), groundAt: () => 0, reducedMotion: false, random: seeded() });
    expect(plan.tumblers).toHaveLength(MAX_TUMBLERS);
    expect(plan.puffs.length).toBe(1 + MAX_EXTRA_PUFFS);
  });

  it('uses only a few light puffs in reduced motion', () => {
    const plan = planCollapse({ origin: { x: 5, y: 1, z: 5 }, fallen: tower(12), groundAt: () => 0, reducedMotion: true });
    expect(plan.tumblers).toHaveLength(0);
    expect(plan.puffs.length).toBe(MAX_REDUCED_PUFFS);
  });

  it('falls back to the lowest block when the origin is unknown', () => {
    const plan = planCollapse({ origin: null, fallen: tower(3), groundAt: () => 0, reducedMotion: false, random: seeded() });
    expect(plan.puffs[0].cell.y).toBe(1);
    expect(planCollapse({ origin: null, fallen: [], groundAt: () => 0, reducedMotion: false })).toEqual({ tumblers: [], puffs: [] });
  });
});

describe('tumble simulation', () => {
  it('falls, bounces exactly once, and finishes in about a second', () => {
    const [spec] = planCollapse({ origin: { x: 5, y: 1, z: 5 }, fallen: tower(6), groundAt: () => 1, reducedMotion: false, random: seeded(7) }).tumblers.slice(-1);
    const s = startTumble(spec);
    let t = 0;
    let lowest = Infinity;
    while (!s.done && t < 5) {
      advanceTumble(spec, s, 1 / 60);
      lowest = Math.min(lowest, s.py);
      t += 1 / 60;
    }
    expect(s.done).toBe(true);
    expect(s.bounces).toBe(1);
    expect(lowest).toBeGreaterThanOrEqual(1.5 - 1e-9); // Never sinks below the ground surface.
    expect(t).toBeLessThanOrEqual(spec.delay + TUMBLE_SECONDS + 0.05);
    expect(Math.abs(s.rx) + Math.abs(s.rz)).toBeGreaterThan(0.5); // It spun.
  });
});
