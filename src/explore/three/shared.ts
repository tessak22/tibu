/**
 * Shared geometries and materials for explore actors. Created lazily once and reused by
 * every character, animal and chest, so adding actors costs no new GPU buffers.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type GeoName =
  | 'sphere'
  | 'sphereLow'
  | 'disc'
  | 'smile'
  | 'cone'
  | 'stem'
  | 'chestBase'
  | 'chestLid'
  | 'band'
  | 'star'
  | 'ring';

const geometries = new Map<GeoName, THREE.BufferGeometry>();
const colorMaterials = new Map<string, THREE.MeshLambertMaterial>();
const textureMaterials = new Map<HTMLCanvasElement, THREE.MeshLambertMaterial>();

function make(name: GeoName): THREE.BufferGeometry {
  switch (name) {
    case 'sphere':
      return new THREE.SphereGeometry(1, 24, 16);
    case 'sphereLow':
      return new THREE.SphereGeometry(1, 12, 8);
    case 'disc':
      return new THREE.CircleGeometry(1, 28);
    case 'smile':
      return new THREE.TorusGeometry(1, 0.22, 6, 16, Math.PI);
    case 'cone':
      return new THREE.ConeGeometry(1, 1, 12);
    case 'stem':
      return new THREE.CylinderGeometry(1, 1, 1, 8);
    case 'chestBase':
      return new RoundedBoxGeometry(1, 1, 1, 3, 0.18);
    case 'chestLid':
      return new RoundedBoxGeometry(1, 1, 1, 3, 0.3);
    case 'band':
      return new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
    case 'star':
      return new THREE.OctahedronGeometry(1, 0);
    case 'ring':
      return new THREE.RingGeometry(0.7, 1, 32);
  }
}

export function geometry(name: GeoName): THREE.BufferGeometry {
  let g = geometries.get(name);
  if (!g) {
    g = make(name);
    geometries.set(name, g);
  }
  return g;
}

/** Opaque soft material by colour (shared). */
export function material(color: string, emissive = 0): THREE.MeshLambertMaterial {
  const key = `${color}|${emissive}`;
  let m = colorMaterials.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    if (emissive > 0) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    colorMaterials.set(key, m);
  }
  return m;
}

/** Material showing a canvas (e.g. an animal face), cached per canvas. */
export function canvasMaterial(canvas: HTMLCanvasElement): THREE.MeshLambertMaterial {
  let m = textureMaterials.get(canvas);
  if (!m) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    // Crop the tile's rim so only the friendly face shows on the round decal.
    tex.repeat.set(0.78, 0.78);
    tex.offset.set(0.11, 0.1);
    m = new THREE.MeshLambertMaterial({ map: tex });
    textureMaterials.set(canvas, m);
  }
  return m;
}

/** A mesh using shared resources, placed and scaled. */
export function part(
  geo: GeoName,
  mat: THREE.Material,
  pos: readonly [number, number, number],
  scale: readonly [number, number, number] | number,
  shadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry(geo), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (typeof scale === 'number') mesh.scale.setScalar(scale);
  else mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = shadow;
  return mesh;
}

/** Big friendly eye: white, dark pupil, two sparkles. Pupil returned for blinking via the group. */
export function eye(x: number, y: number, z: number, r: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(part('sphere', material('#ffffff'), [0, 0, 0], [r, r * 1.1, r * 0.55], false));
  g.add(part('sphere', material('#3b2f4a'), [0, -r * 0.08, r * 0.38], [r * 0.7, r * 0.8, r * 0.3], false));
  g.add(part('sphereLow', material('#ffffff', 0.6), [r * 0.25, r * 0.25, r * 0.6], r * 0.22, false));
  g.add(part('sphereLow', material('#ffffff', 0.6), [-r * 0.2, -r * 0.3, r * 0.6], r * 0.1, false));
  return g;
}

let users = 0;

/**
 * Registers one user of the shared resources (an explorer). The returned release function frees
 * every shared geometry, material and texture once the last user is gone, so a new explorer
 * created before an old one is disposed keeps its resources. Releasing twice is a no-op.
 */
export function acquireShared(): () => void {
  users += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users = Math.max(0, users - 1);
    if (users === 0) disposeShared();
  };
}

/** Number of live users (tests). */
export function sharedUsers(): number {
  return users;
}

/** Shared resources currently alive (tests). */
export function sharedCount(): number {
  return geometries.size + colorMaterials.size + textureMaterials.size;
}

/** Free everything now. Prefer acquireShared(): this ignores other users. */
export function disposeShared(): void {
  for (const g of geometries.values()) g.dispose();
  for (const m of colorMaterials.values()) m.dispose();
  for (const m of textureMaterials.values()) {
    m.map?.dispose();
    m.dispose();
  }
  geometries.clear();
  colorMaterials.clear();
  textureMaterials.clear();
}
