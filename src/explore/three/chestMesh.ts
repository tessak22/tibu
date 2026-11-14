/** A cute rounded treasure chest with a hinged lid, gold bands, a heart lock and sparkles. */
import * as THREE from 'three';
import { material, part } from './shared';

export interface ChestRig {
  readonly root: THREE.Group;
  /** Lid pivot (hinge at the back). rotation.x < 0 opens it. */
  readonly lid: THREE.Group;
  readonly sparkles: readonly THREE.Mesh[];
  readonly glow: THREE.Mesh;
}

const WOOD = '#e59866';
const WOOD_DARK = '#b86b3c';
const GOLD = '#ffd23f';

export function buildChest(): ChestRig {
  const root = new THREE.Group();
  root.name = 'explore-chest';
  root.add(part('chestBase', material(WOOD), [0, 0.2, 0], [0.62, 0.4, 0.46]));
  root.add(part('band', material(GOLD), [-0.18, 0.2, 0], [0.07, 0.42, 0.48]));
  root.add(part('band', material(GOLD), [0.18, 0.2, 0], [0.07, 0.42, 0.48]));
  // Inside (seen when open).
  root.add(part('band', material('#6b3a2a'), [0, 0.39, 0], [0.54, 0.02, 0.38], false));

  const lid = new THREE.Group();
  lid.position.set(0, 0.4, -0.23);
  lid.add(part('chestLid', material(WOOD_DARK), [0, 0.07, 0.23], [0.64, 0.18, 0.48]));
  lid.add(part('band', material(GOLD), [-0.18, 0.08, 0.23], [0.075, 0.2, 0.5]));
  lid.add(part('band', material(GOLD), [0.18, 0.08, 0.23], [0.075, 0.2, 0.5]));
  const lock = part('sphere', material('#ff6b8b', 0.25), [0, 0.0, 0.48], [0.06, 0.06, 0.03]);
  lid.add(lock);
  root.add(lid);

  const sparkles: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const s = part('star', material('#fff4b0', 0.9), [0, 0.7, 0], 0.045, false);
    root.add(s);
    sparkles.push(s);
  }
  const glow = part('disc', material('#fff4b0', 0.5), [0, 0.42, 0], 0.18, false);
  glow.rotation.x = -Math.PI / 2;
  glow.visible = false;
  root.add(glow);
  return { root, lid, sparkles, glow };
}
