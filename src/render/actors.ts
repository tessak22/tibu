import * as THREE from 'three';
import type { ActorOptions } from '../core/types';

const isShown = (o: THREE.Object3D | null): boolean => {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
};

/**
 * Non-block objects in the world (character, animals, chests). The caller owns each object and
 * its GPU resources; the view only adds it to the scene and removes it again.
 */
export class Actors {
  readonly group = new THREE.Group();
  private readonly options = new Map<THREE.Object3D, ActorOptions>();

  constructor() {
    this.group.name = 'actors';
  }

  add(object: THREE.Object3D, options: ActorOptions = {}): () => void {
    this.options.set(object, options);
    this.group.add(object);
    return () => {
      if (!this.options.delete(object)) return;
      this.group.remove(object);
    };
  }

  count(): number {
    return this.options.size;
  }

  /** The nearest visible tappable actor along the ray (with its ray distance), or null. */
  hit(raycaster: THREE.Raycaster): { readonly options: ActorOptions; readonly distance: number } | null {
    const tappable = [...this.options].filter(([o, opts]) => opts.onTap && o.visible).map(([o]) => o);
    if (tappable.length === 0) return null;
    for (const hit of raycaster.intersectObjects(tappable, true)) {
      if (!isShown(hit.object)) continue;
      const root = this.rootOf(hit.object);
      const options = root ? this.options.get(root) : undefined;
      if (options) return { options, distance: hit.distance };
    }
    return null;
  }

  /** Removes every actor from the scene (does not dispose caller-owned objects). */
  clear(): void {
    for (const o of this.options.keys()) this.group.remove(o);
    this.options.clear();
  }

  private rootOf(o: THREE.Object3D): THREE.Object3D | null {
    for (let n: THREE.Object3D | null = o; n; n = n.parent) if (this.options.has(n)) return n;
    return null;
  }
}
