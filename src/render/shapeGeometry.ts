import * as THREE from 'three';
import { FACE_NAMES, type BlockShape, type Rotation } from '../core/types';
import { BOX_FACE_ORDER } from './faces';
import { isPart, shapeTemplate, type ShapeTemplate } from './shapes';

/** Converts a part template into a cell-centered BufferGeometry with one group per face canvas. */
export function templateToGeometry(t: ShapeTemplate): THREE.BufferGeometry {
  const n = t.positions.length / 3;
  const positions = new Float32Array(t.positions.length);
  const colors = new Float32Array(t.positions.length);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = t.positions[i * 3] - 0.5;
    positions[i * 3 + 1] = t.positions[i * 3 + 1] - 0.5;
    positions[i * 3 + 2] = t.positions[i * 3 + 2] - 0.5;
    colors.fill(t.shades[i], i * 3, i * 3 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(t.normals.slice(), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(t.uvs.slice(), 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Sort triangles by face so each face canvas is one draw group (material index = FACE_NAMES order).
  const sorted: number[] = [];
  for (let f = 0; f < FACE_NAMES.length; f++) {
    const start = sorted.length;
    for (let i = 0; i < t.indices.length; i += 3) {
      if (t.faces[t.indices[i]] === f) sorted.push(t.indices[i], t.indices[i + 1], t.indices[i + 2]);
    }
    if (sorted.length > start) g.addGroup(start, sorted.length - start, f);
  }
  g.setIndex(sorted);
  g.computeBoundingSphere();
  return g;
}

export interface OverlayShape {
  readonly geometry: THREE.BufferGeometry;
  /** Face order of the material array this geometry expects. */
  readonly faceOrder: readonly (typeof FACE_NAMES)[number][];
  /** Parts carry baked contact shading in vertex colors. */
  readonly vertexColors: boolean;
}

/**
 * Shared, cell-centered overlay geometries: a unit box for cubes (matches the merged mesh) and the real part
 * geometry for every shape and rotation. Owned by the scene graph; dispose once.
 */
export class ShapeGeometries {
  readonly cube: OverlayShape = {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    faceOrder: BOX_FACE_ORDER,
    vertexColors: false,
  };
  private readonly parts = new Map<string, OverlayShape>();

  get(shape: BlockShape, rot: Rotation): OverlayShape {
    if (!isPart(shape)) return this.cube;
    const key = `${shape}:${rot}`;
    let entry = this.parts.get(key);
    if (!entry) {
      entry = { geometry: templateToGeometry(shapeTemplate(shape, rot)), faceOrder: FACE_NAMES, vertexColors: true };
      this.parts.set(key, entry);
    }
    return entry;
  }

  dispose(): void {
    this.cube.geometry.dispose();
    for (const p of this.parts.values()) p.geometry.dispose();
    this.parts.clear();
  }
}

/** One material per face for an overlay mesh of a block. Caller owns (and disposes) them. */
export function overlayMaterials(
  textures: readonly THREE.Texture[],
  overlay: OverlayShape,
  params: THREE.MeshLambertMaterialParameters = {},
): THREE.MeshLambertMaterial[] {
  return textures.map((map) => new THREE.MeshLambertMaterial({ map, vertexColors: overlay.vertexColors, ...params }));
}
