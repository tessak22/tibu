import * as THREE from 'three';
import type { Cell, GhostBlock } from '../../core/types';
import type { BlockLooks } from '../blockLook';
import { overlayMaterials, type ShapeGeometries } from '../shapeGeometry';

/** A step-by-step build never shows more than this many ghosts at once. */
export const MAX_GHOSTS = 120;
const BASE_OPACITY = 0.34;
const PULSE_OPACITY = 0.14;
const HOVER_OPACITY = 0.78;

interface GhostMesh {
  readonly ghost: GhostBlock;
  readonly mesh: THREE.Mesh;
  readonly materials: THREE.MeshLambertMaterial[];
}

const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/**
 * Translucent, gently pulsing preview blocks with their real art (parts rotated). The ghost under
 * the child's finger turns nearly solid. Ghost cells are tappable targets (see targeting.ts).
 */
export class Ghosts {
  readonly group = new THREE.Group();
  private items: GhostMesh[] = [];
  private readonly byCell = new Map<string, GhostMesh>();
  private hovered: GhostMesh | null = null;
  private time = 0;

  constructor(
    private readonly looks: BlockLooks,
    private readonly geometries: ShapeGeometries,
  ) {
    this.group.name = 'ghosts';
  }

  set(ghosts: readonly GhostBlock[] | null): void {
    this.clear();
    for (const ghost of (ghosts ?? []).slice(0, MAX_GHOSTS)) {
      const { x, y, z } = ghost.cell;
      if (this.byCell.has(keyOf(x, y, z))) continue;
      const overlay = this.geometries.get(this.looks.shape(ghost.block), ghost.rot ?? 0);
      const materials = overlayMaterials(this.looks.texturesIn(ghost.block, overlay.faceOrder), overlay, {
        transparent: true,
        opacity: BASE_OPACITY,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(overlay.geometry, materials);
      mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      mesh.renderOrder = 4;
      const item = { ghost, mesh, materials };
      this.items.push(item);
      this.byCell.set(keyOf(x, y, z), item);
      this.group.add(mesh);
    }
  }

  count(): number {
    return this.items.length;
  }

  has(x: number, y: number, z: number): boolean {
    return this.byCell.has(keyOf(x, y, z));
  }

  at(cell: Cell): GhostBlock | null {
    return this.byCell.get(keyOf(cell.x, cell.y, cell.z))?.ghost ?? null;
  }

  /** The finger is over this cell (or nothing): that ghost becomes nearly opaque. */
  setHovered(cell: Cell | null): void {
    this.hovered = cell ? (this.byCell.get(keyOf(cell.x, cell.y, cell.z)) ?? null) : null;
  }

  isAnimating(): boolean {
    return this.items.length > 0;
  }

  /** `isSolid`: ghosts whose cell is already built are hidden. */
  update(dt: number, reducedMotion: boolean, isSolid: (c: Cell) => boolean): void {
    if (this.items.length === 0) return;
    this.time += dt;
    const pulse = reducedMotion ? 0.5 : Math.sin(this.time * 3.2) * 0.5 + 0.5;
    for (const item of this.items) {
      item.mesh.visible = !isSolid(item.ghost.cell);
      const hovered = item === this.hovered;
      const opacity = hovered ? HOVER_OPACITY : BASE_OPACITY + pulse * PULSE_OPACITY;
      for (const m of item.materials) m.opacity = opacity;
      item.mesh.scale.setScalar(hovered ? 1 : 0.94 + pulse * 0.04);
    }
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    for (const item of this.items) {
      this.group.remove(item.mesh);
      for (const m of item.materials) m.dispose();
    }
    this.items = [];
    this.byCell.clear();
    this.hovered = null;
  }
}
