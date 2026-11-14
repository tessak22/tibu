import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCharacterController } from '../../../src/explore/characterController';
import * as walk from '../../../src/explore/walkApi';
import type { Space } from '../../../src/explore/space';
import { fakeWorld } from './fakeWorld';

const space: Space = { unit: 1, feet: (x, y, z, out: THREE.Vector3) => out.set(x + 0.5, y, z + 0.5) };

function setup() {
  const world = fakeWorld();
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) world.place({ x, y: 0, z }, 'nature:grass');
  const character = createCharacterController({
    world,
    walk,
    space,
    spawn: { x: 2, y: 1, z: 2 },
    reducedMotion: () => false,
    hooks: { onHop: () => undefined, onArrive: () => false, onShrug: () => undefined },
  });
  return character;
}

describe('character update reports motion', () => {
  it('is idle while standing (breathing alone does not keep the view busy)', () => {
    const c = setup();
    expect(c.update(1 / 60)).toBe(false);
  });

  it('is busy while walking, then goes idle after its little arrival hop', () => {
    const c = setup();
    c.walkTo({ x: 6, y: 1, z: 2 });
    expect(c.update(1 / 60)).toBe(true);
    let frames = 0;
    while (c.update(1 / 30) && frames < 2_000) frames++;
    expect(frames).toBeLessThan(2_000);
    expect(c.cell()).toEqual({ x: 6, y: 1, z: 2 });
    expect(c.update(1 / 30)).toBe(false);
  });
});
