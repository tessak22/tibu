/**
 * "Pip": Tibu's explorer buddy. A soft round bean creature with a leaf sprout, big shiny
 * eyes, rosy cheeks, nub arms and little feet. Built only from rounded primitives.
 */
import * as THREE from 'three';
import { eye, material, part } from './shared';

export type CharacterVariant = 'mint' | 'peach' | 'lavender' | 'sunny';

interface Palette {
  readonly body: string;
  readonly belly: string;
  readonly feet: string;
  readonly leaf: string;
}

const PALETTES: Readonly<Record<CharacterVariant, Palette>> = {
  mint: { body: '#7fdcc4', belly: '#e6fff6', feet: '#4fb8a0', leaf: '#8fd14f' },
  peach: { body: '#ffb38a', belly: '#fff1e6', feet: '#e88b62', leaf: '#7cc96b' },
  lavender: { body: '#b9a6ff', belly: '#f3efff', feet: '#8f78e8', leaf: '#7fd38a' },
  sunny: { body: '#ffd96b', belly: '#fffbe8', feet: '#f0b43c', leaf: '#6fcf6a' },
};

/** Picks a buddy colour that goes with the child's profile animal. */
export function variantForAnimal(animal: string | undefined): CharacterVariant {
  switch (animal) {
    case 'cat':
    case 'fox':
    case 'pig':
    case 'dog':
      return 'peach';
    case 'bunny':
    case 'mouse':
    case 'owl':
      return 'lavender';
    case 'duck':
    case 'chicken':
    case 'lion':
    case 'bee':
      return 'sunny';
    default:
      return 'mint';
  }
}

export interface CharacterRig {
  readonly root: THREE.Group;
  /** Vertical offset (hops, bob). */
  readonly lift: THREE.Group;
  /** Squash and stretch, pivoting at the feet. */
  readonly squash: THREE.Group;
  readonly eyes: THREE.Group;
  readonly sprout: THREE.Group;
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly footL: THREE.Mesh;
  readonly footR: THREE.Mesh;
}

function arm(side: 1 | -1, color: string): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.26, 0.3, 0.03);
  pivot.add(part('sphere', material(color), [side * 0.02, -0.1, 0], [0.06, 0.095, 0.06]));
  return pivot;
}

export function buildCharacter(variant: CharacterVariant = 'mint'): CharacterRig {
  const pal = PALETTES[variant];
  const root = new THREE.Group();
  root.name = 'explore-character';
  const lift = new THREE.Group();
  const squash = new THREE.Group();
  root.add(lift);
  lift.add(squash);

  const body = material(pal.body);
  squash.add(part('sphere', body, [0, 0.36, 0], [0.3, 0.32, 0.28]));
  squash.add(part('sphere', material(pal.belly), [0, 0.2, 0.12], [0.17, 0.13, 0.15], false));

  const eyes = new THREE.Group();
  eyes.position.set(0, 0.43, 0.22);
  eyes.add(eye(-0.105, 0, 0, 0.085));
  eyes.add(eye(0.105, 0, 0, 0.085));
  squash.add(eyes);
  squash.add(part('sphereLow', material('#ff9fb4'), [-0.19, 0.35, 0.2], [0.05, 0.03, 0.02], false));
  squash.add(part('sphereLow', material('#ff9fb4'), [0.19, 0.35, 0.2], [0.05, 0.03, 0.02], false));
  const mouth = part('smile', material('#5a3d55'), [0, 0.345, 0.268], 0.035, false);
  mouth.rotation.z = Math.PI;
  squash.add(mouth);

  const sprout = new THREE.Group();
  sprout.position.set(0, 0.66, 0);
  sprout.add(part('stem', material(pal.leaf), [0, 0.05, 0], [0.015, 0.1, 0.015], false));
  const leafL = part('sphere', material(pal.leaf), [-0.06, 0.11, 0], [0.07, 0.025, 0.04]);
  leafL.rotation.z = 0.5;
  const leafR = part('sphere', material(pal.leaf), [0.06, 0.12, 0], [0.07, 0.025, 0.04]);
  leafR.rotation.z = -0.5;
  sprout.add(leafL, leafR);
  squash.add(sprout);

  const armL = arm(-1, pal.body);
  const armR = arm(1, pal.body);
  squash.add(armL, armR);

  const footL = part('sphere', material(pal.feet), [-0.12, 0.04, 0.05], [0.09, 0.05, 0.11]);
  const footR = part('sphere', material(pal.feet), [0.12, 0.04, 0.05], [0.09, 0.05, 0.11]);
  lift.add(footL, footR);

  return { root, lift, squash, eyes, sprout, armL, armR, footL, footR };
}
