import * as THREE from 'three';
import type { Cell } from '../../core/types';

const DURATION = 1.1;
const RING_COLOR = '#ffffff';
const DOT_COLOR = '#7ff0c9';

/** A small, friendly target ring where the child tapped in walk mode. Pops in, then fades. */
export class WalkMarker {
  readonly group = new THREE.Group();
  private readonly ringGeometry = new THREE.TorusGeometry(0.32, 0.07, 8, 28);
  private readonly dotGeometry = new THREE.CircleGeometry(0.2, 20);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: RING_COLOR,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly dotMaterial = new THREE.MeshBasicMaterial({
    color: DOT_COLOR,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  private t = DURATION;
  private reduced = false;

  constructor() {
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    const dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = -0.01;
    ring.renderOrder = 6;
    dot.renderOrder = 6;
    this.group.add(dot, ring);
    this.group.visible = false;
  }

  /** Shows the ring on the floor of `cell` (the cell the character will stand in). */
  show(cell: Cell, reducedMotion: boolean): void {
    this.group.position.set(cell.x + 0.5, cell.y + 0.05, cell.z + 0.5);
    this.t = 0;
    this.reduced = reducedMotion;
    this.group.visible = true;
  }

  isAnimating(): boolean {
    return this.group.visible;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    const k = Math.min(1, this.t / DURATION);
    if (k >= 1) {
      this.group.visible = false;
      return;
    }
    const grow = this.reduced ? 1 : 0.5 + 0.5 * (1 - (1 - Math.min(1, k * 4)) ** 3) + Math.sin(k * Math.PI) * 0.12;
    this.group.scale.setScalar(grow);
    const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    this.ringMaterial.opacity = 0.95 * fade;
    this.dotMaterial.opacity = 0.55 * fade;
  }

  dispose(): void {
    this.ringGeometry.dispose();
    this.dotGeometry.dispose();
    this.ringMaterial.dispose();
    this.dotMaterial.dispose();
  }
}
