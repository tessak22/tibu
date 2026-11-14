import * as THREE from 'three';
import type { BlockKey, Cell } from '../../core/types';
import type { BlockLooks } from '../blockLook';

const DURATION = 0.5;

interface ActiveBounce {
  readonly cell: Cell;
  readonly mesh: THREE.Mesh;
  readonly materials: THREE.MeshLambertMaterial[];
  t: number;
}

/**
 * Squash-and-stretch for one cell: the merged chunk hides the cell while a textured overlay
 * cube animates, then the cell is shown again.
 */
export class BounceEffects {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly active: ActiveBounce[] = [];

  constructor(
    private readonly looks: BlockLooks,
    private readonly setHidden: (cell: Cell, hidden: boolean) => void,
  ) {}

  start(cell: Cell, block: BlockKey, gentle: boolean): void {
    if (this.indexOf(cell) !== -1) return;
    const materials = this.looks.boxTextures(block).map((map) => new THREE.MeshLambertMaterial({ map }));
    const mesh = new THREE.Mesh(this.geometry, materials);
    mesh.castShadow = true;
    mesh.userData.gentle = gentle;
    this.group.add(mesh);
    this.active.push({ cell, mesh, materials, t: 0 });
    this.setHidden(cell, true);
    this.place(this.active[this.active.length - 1]);
  }

  /** Stops the bounce on this cell at once (the block was removed or the placement undone). */
  cancel(cell: Cell): void {
    const i = this.indexOf(cell);
    if (i !== -1) this.finish(i);
  }

  isAnimating(): boolean {
    return this.active.length > 0;
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.t += dt;
      if (b.t >= DURATION) {
        this.finish(i);
        continue;
      }
      this.place(b);
    }
  }

  dispose(): void {
    while (this.active.length) this.finish(this.active.length - 1);
    this.geometry.dispose();
  }

  private indexOf(cell: Cell): number {
    return this.active.findIndex((b) => b.cell.x === cell.x && b.cell.y === cell.y && b.cell.z === cell.z);
  }

  private place(b: ActiveBounce): void {
    const k = b.t / DURATION;
    const amp = b.mesh.userData.gentle ? 0.08 : 0.22;
    const wave = Math.sin(k * Math.PI * 2) * (1 - k) * amp;
    const sy = 1 - wave;
    const sxz = 1 + wave * 0.6;
    b.mesh.scale.set(sxz, sy, sxz);
    // Keep the bottom on the ground while squashing; hop slightly on the stretch.
    const hop = Math.max(0, -wave) * 0.6;
    b.mesh.position.set(b.cell.x + 0.5, b.cell.y + sy / 2 + hop, b.cell.z + 0.5);
  }

  private finish(index: number): void {
    const [b] = this.active.splice(index, 1);
    this.group.remove(b.mesh);
    for (const m of b.materials) m.dispose();
    this.setHidden(b.cell, false);
  }
}
