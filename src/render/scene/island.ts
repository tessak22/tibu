import * as THREE from 'three';
import type { ThemeDef } from '../../core/types';
import { islandMask } from '../../world/island';
import { buildUnderside } from './undersideGeometry';

/** The decorative rocky underside of the floating island (below the grid, never part of the world). */
export class IslandUnderside {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private mesh: THREE.Mesh | null = null;

  setTheme(theme: ThemeDef): void {
    this.clear();
    const arrays = buildUnderside(islandMask(theme.island.shape), theme.island.depth);
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
