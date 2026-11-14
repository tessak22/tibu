import * as THREE from 'three';
import type { BlockKey, Cell } from '../../core/types';
import type { BlockLooks } from '../blockLook';
import { overlayMaterials, type ShapeGeometries } from '../shapeGeometry';
import { advanceTumble, startTumble, type CollapsePlan, type TumbleSpec, type TumbleState } from './collapsePlan';

interface Tumbler {
  readonly spec: TumbleSpec;
  readonly state: TumbleState;
  readonly mesh: THREE.Mesh;
}

/** Called when a block should pop into a puff (smash particles). */
export type PopHandler = (center: THREE.Vector3, block: BlockKey) => void;

/** Renders collapse plans: tumbling overlay blocks that bounce once and pop. */
export class CollapseEffects {
  readonly group = new THREE.Group();
  private tumblers: Tumbler[] = [];
  /** Shared per block while any of its tumblers fly; freed when the collapse ends. */
  private readonly materials = new Map<string, THREE.MeshLambertMaterial[]>();
  private readonly point = new THREE.Vector3();

  constructor(
    private readonly looks: BlockLooks,
    private readonly geometries: ShapeGeometries,
    private readonly onPop: PopHandler,
  ) {
    this.group.name = 'collapse';
  }

  start(plan: CollapsePlan): void {
    for (const puff of plan.puffs) {
      this.onPop(this.point.set(puff.cell.x + 0.5, puff.cell.y + 0.5, puff.cell.z + 0.5), puff.block);
    }
    for (const spec of plan.tumblers) {
      const overlay = this.geometries.get(this.looks.shape(spec.block), spec.rot);
      const key = `${spec.block}|${overlay.vertexColors}`;
      let mats = this.materials.get(key);
      if (!mats) {
        mats = overlayMaterials(this.looks.texturesIn(spec.block, overlay.faceOrder), overlay);
        this.materials.set(key, mats);
      }
      const mesh = new THREE.Mesh(overlay.geometry, mats);
      const state = startTumble(spec);
      mesh.position.set(state.px, state.py, state.pz);
      this.group.add(mesh);
      this.tumblers.push({ spec, state, mesh });
    }
  }

  /** Stops any tumbler that started from this cell (e.g. the collapse was undone mid-air). */
  cancel(cell: Cell): void {
    this.tumblers = this.tumblers.filter((t) => {
      const c = t.spec.cell;
      const match = c.x === cell.x && c.y === cell.y && c.z === cell.z;
      if (match) this.group.remove(t.mesh);
      return !match;
    });
    this.releaseIfIdle();
  }

  isAnimating(): boolean {
    return this.tumblers.length > 0;
  }

  update(dt: number): void {
    if (this.tumblers.length === 0) return;
    const alive: Tumbler[] = [];
    for (const t of this.tumblers) {
      advanceTumble(t.spec, t.state, dt);
      const s = t.state;
      if (s.done) {
        this.group.remove(t.mesh);
        this.onPop(this.point.set(s.px, s.py, s.pz), t.spec.block);
        continue;
      }
      t.mesh.position.set(s.px, s.py, s.pz);
      t.mesh.rotation.set(s.rx, 0, s.rz);
      alive.push(t);
    }
    this.tumblers = alive;
    this.releaseIfIdle();
  }

  dispose(): void {
    for (const t of this.tumblers) this.group.remove(t.mesh);
    this.tumblers = [];
    this.releaseIfIdle();
  }

  private releaseIfIdle(): void {
    if (this.tumblers.length > 0) return;
    for (const mats of this.materials.values()) for (const m of mats) m.dispose();
    this.materials.clear();
  }
}
