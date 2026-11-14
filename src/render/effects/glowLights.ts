import * as THREE from 'three';
import type { BlockLooks } from '../blockLook';
import type { VoxelMirror } from '../voxelMirror';

const MAX_LIGHTS = 4;
const RESCAN_SECONDS = 0.6;

/**
 * A small, fixed-size pool of point lights placed at the glowing blocks nearest the camera.
 * The pool size never changes (unused lights get intensity 0) so shaders never recompile.
 */
export class GlowLights {
  readonly group = new THREE.Group();
  private readonly lights: THREE.PointLight[] = [];
  private sinceScan = RESCAN_SECONDS;
  private dirty = true;
  private glowCells: { x: number; y: number; z: number; color: THREE.Color }[] = [];
  private limit = MAX_LIGHTS;

  constructor(
    private readonly mirror: VoxelMirror,
    private readonly looks: BlockLooks,
  ) {
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = new THREE.PointLight('#fff3c4', 0, 7, 1.6);
      light.castShadow = false;
      this.lights.push(light);
      this.group.add(light);
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  setLimit(limit: number): void {
    this.limit = Math.max(0, Math.min(MAX_LIGHTS, limit));
    this.sinceScan = RESCAN_SECONDS;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.sinceScan += dt;
    if (this.dirty) this.rescan();
    if (this.sinceScan < RESCAN_SECONDS) return;
    this.sinceScan = 0;
    const cam = camera.position;
    const nearest = [...this.glowCells]
      .sort(
        (a, b) =>
          cam.distanceToSquared(new THREE.Vector3(a.x + 0.5, a.y + 0.5, a.z + 0.5)) -
          cam.distanceToSquared(new THREE.Vector3(b.x + 0.5, b.y + 0.5, b.z + 0.5)),
      )
      .slice(0, this.limit);
    this.lights.forEach((light, i) => {
      const cell = nearest[i];
      if (!cell) {
        light.intensity = 0;
        return;
      }
      light.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
      light.color.copy(cell.color);
      light.intensity = 6;
    });
  }

  dispose(): void {
    for (const light of this.lights) light.dispose();
  }

  private rescan(): void {
    this.dirty = false;
    this.sinceScan = RESCAN_SECONDS;
    const cells: typeof this.glowCells = [];
    for (const [c, key] of this.mirror.grid.entries()) {
      if (this.looks.isGlow(key)) cells.push({ ...c, color: this.looks.glowColor(key) });
    }
    this.glowCells = cells;
  }
}
