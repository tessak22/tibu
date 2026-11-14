import * as THREE from 'three';
import type { ThemeDef } from '../../core/types';
import { buildUnderside, type MaskSize } from './undersideGeometry';

/**
 * The decorative rocky underside of the floating island(s), below the grid and never part of the
 * world. Built from the world's floor layer, so explore worlds get a rock under every island.
 */
export class IslandUnderside {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private mesh: THREE.Mesh | null = null;

  build(theme: ThemeDef, floorMask: Uint8Array, size: MaskSize): void {
    this.clear();
    if (!floorMask.some((v) => v !== 0)) return;
    const arrays = buildUnderside(floorMask, theme.island.depth, size);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(arrays.normals, 3));
    g.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3));
    g.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
    g.computeBoundingSphere();
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'island-underside';
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }

  dispose(): void {
    this.clear();
    this.material.dispose();
  }

  private clear(): void {
    if (!this.mesh) return;
    this.group.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
  }
}
