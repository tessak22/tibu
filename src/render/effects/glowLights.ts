import * as THREE from 'three';
import type { BlockLooks } from '../blockLook';
import type { VoxelMirror } from '../voxelMirror';

const MAX_LIGHTS = 4;

interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The `limit` cells whose centers are nearest to `from`. Distances are computed once each. */
export function nearestCells<T extends Point>(cells: readonly T[], from: Point, limit: number): T[] {
  if (limit <= 0 || cells.length === 0) return [];
  return cells
    .map((cell) => {
      const dx = cell.x + 0.5 - from.x;
      const dy = cell.y + 0.5 - from.y;
      const dz = cell.z + 0.5 - from.z;
      return { cell, d: dx * dx + dy * dy + dz * dz };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((entry) => entry.cell);
}
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
    const nearest = nearestCells(this.glowCells, camera.position, this.limit);
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
