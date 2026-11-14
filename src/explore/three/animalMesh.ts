/**
 * Rounded 3D animals: a soft ellipsoid body, a round head wearing the pack's animal face
 * art as a decal, stubby legs and a few kind-specific bits (ears, beak, tail).
 */
import * as THREE from 'three';
import { canvasMaterial, material, part } from './shared';

type EarStyle = 'round' | 'pointy' | 'long' | 'floppy' | 'horn' | 'none';
interface AnimalShape {
  readonly scale: number;
  readonly ears: EarStyle;
  readonly bird: boolean;
  readonly long: boolean;
}

const SHAPES: Readonly<Record<string, AnimalShape>> = {
  cow: { scale: 1, ears: 'horn', bird: false, long: true },
  horse: { scale: 1, ears: 'pointy', bird: false, long: true },
  pig: { scale: 0.85, ears: 'pointy', bird: false, long: true },
  sheep: { scale: 0.85, ears: 'floppy', bird: false, long: true },
  dog: { scale: 0.8, ears: 'floppy', bird: false, long: true },
  cat: { scale: 0.72, ears: 'pointy', bird: false, long: true },
  bunny: { scale: 0.7, ears: 'long', bird: false, long: false },
  mouse: { scale: 0.58, ears: 'round', bird: false, long: true },
  chicken: { scale: 0.68, ears: 'none', bird: true, long: false },
  duck: { scale: 0.68, ears: 'none', bird: true, long: false },
  bird: { scale: 0.55, ears: 'none', bird: true, long: false },
  frog: { scale: 0.6, ears: 'none', bird: false, long: false },
};

export interface AnimalRig {
  readonly root: THREE.Group;
  readonly lift: THREE.Group;
  readonly squash: THREE.Group;
  readonly head: THREE.Group;
  readonly legs: readonly THREE.Object3D[];
  readonly size: number;
}

function ears(head: THREE.Group, style: EarStyle, fur: string, inner: string): void {
  const m = material(fur);
  const add = (side: number): void => {
    switch (style) {
      case 'round':
        head.add(part('sphere', m, [side * 0.15, 0.16, -0.02], [0.09, 0.09, 0.03]));
        break;
      case 'pointy': {
        const e = part('cone', m, [side * 0.12, 0.2, -0.02], [0.06, 0.12, 0.04]);
        e.rotation.z = -side * 0.35;
        head.add(e);
        break;
      }
      case 'long': {
        const e = part('sphere', m, [side * 0.07, 0.3, -0.03], [0.05, 0.16, 0.03]);
        e.rotation.z = -side * 0.15;
        head.add(e);
        head.add(part('sphereLow', material(inner), [side * 0.07, 0.3, -0.003], [0.03, 0.12, 0.01], false));
        break;
      }
      case 'floppy': {
        const e = part('sphere', material(inner === fur ? fur : inner), [side * 0.2, 0.02, -0.02], [0.05, 0.11, 0.05]);
        e.rotation.z = side * 0.4;
        head.add(e);
        break;
      }
      case 'horn': {
        head.add(part('cone', material('#f3dc9a'), [side * 0.11, 0.21, -0.03], [0.035, 0.09, 0.035]));
        break;
      }
      case 'none':
        break;
    }
  };
  add(-1);
  add(1);
}

/**
 * @param kind animal id from the animals pack (e.g. "cow")
 * @param face square face canvas (the pack's front face art)
 * @param fur body colour
 */
export function buildAnimal(kind: string, face: HTMLCanvasElement, fur: string): AnimalRig {
  const shape = SHAPES[kind] ?? { scale: 0.7, ears: 'round', bird: false, long: false };
  const root = new THREE.Group();
  root.name = `explore-animal-${kind}`;
  const lift = new THREE.Group();
  const squash = new THREE.Group();
  squash.scale.setScalar(shape.scale);
  root.add(lift);
  lift.add(squash);

  const furMat = material(fur);
  const bodyLen = shape.long ? 0.3 : 0.22;
  squash.add(part('sphere', furMat, [0, 0.3, -0.04], [0.24, 0.21, bodyLen]));

  const head = new THREE.Group();
  head.position.set(0, shape.bird ? 0.52 : 0.46, shape.long ? 0.22 : 0.12);
  head.add(part('sphere', furMat, [0, 0, 0], [0.2, 0.19, 0.17]));
  const decal = part('disc', canvasMaterial(face), [0, -0.01, 0.166], 0.155, false);
  head.add(decal);
  ears(head, shape.ears, fur, '#ffc2cf');
  if (kind === 'sheep') head.add(part('sphereLow', material('#ffffff'), [0, 0.14, -0.02], [0.15, 0.08, 0.12]));
  squash.add(head);

  const legs: THREE.Object3D[] = [];
  const legMat = material(kind === 'duck' || kind === 'chicken' ? '#ffa94d' : fur);
  const legSpots: readonly (readonly [number, number])[] = shape.bird
    ? [
        [-0.08, 0],
        [0.08, 0],
      ]
    : [
        [-0.13, 0.12],
        [0.13, 0.12],
        [-0.13, -0.18],
        [0.13, -0.18],
      ];
  for (const [x, z] of legSpots) {
    const leg = part('sphere', legMat, [x, 0.08, z], shape.bird ? [0.04, 0.09, 0.06] : [0.07, 0.1, 0.07]);
    squash.add(leg);
    legs.push(leg);
  }
  if (shape.bird) {
    const wingL = part('sphere', furMat, [-0.22, 0.32, -0.04], [0.05, 0.11, 0.15]);
    const wingR = part('sphere', furMat, [0.22, 0.32, -0.04], [0.05, 0.11, 0.15]);
    squash.add(wingL, wingR);
  } else if (kind !== 'frog') {
    squash.add(part('sphereLow', material(kind === 'bunny' || kind === 'sheep' ? '#ffffff' : fur), [0, 0.36, -0.04 - bodyLen], 0.06));
  }
  return { root, lift, squash, head, legs, size: shape.scale };
}
