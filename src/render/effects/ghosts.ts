import * as THREE from 'three';
import type { Cell, GhostBlock } from '../../core/types';
import type { BlockLooks } from '../blockLook';
import { overlayMaterials, type ShapeGeometries } from '../shapeGeometry';
import { outlineGeometry } from './ghostOutline';

/** A step-by-step build never shows more than this many ghosts at once. */
export const MAX_GHOSTS = 120;
const BASE_OPACITY = 0.55;
const PULSE_OPACITY = 0.15;
const HOVER_OPACITY = 0.88;
/** Magic-preview tint: cyan reads against grass, sand, snow and the dark of space. */
const GLOW_COLOR = '#3fe6ff';
const OUTLINE_COLOR = '#c9fbff';
const OUTLINE_HOVER_COLOR = '#ffffff';
const GLOW_MIN = 0.18;
const GLOW_PULSE = 0.22;
const RIM_SCALE = 1.14;

interface GhostMesh {
  readonly ghost: GhostBlock;
  /** Holds the art, the outline bars and the soft rim; scaled as one for the pulse. */
  readonly root: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly outline: THREE.Mesh;
  readonly rim: THREE.Mesh;
  readonly materials: THREE.MeshLambertMaterial[];
}

const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/**
 * Preview blocks for the current build step, made to stand out from the scenery: their real art
 * (parts rotated, real shape) lit with a cyan glow, bold bright outline bars along the shape's
 * edges, and a soft cyan rim around the silhouette, all gently pulsing. The ghost under the
 * child's finger turns nearly solid with a white outline. Ghost cells are tappable targets
 * (see targeting.ts).
 */
export class Ghosts {
  readonly group = new THREE.Group();
  private items: GhostMesh[] = [];
  private readonly byCell = new Map<string, GhostMesh>();
  private hovered: GhostMesh | null = null;
  private time = 0;
  /** Outline bars per overlay geometry (shared by ghosts of the same shape and rotation). */
  private readonly outlines = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  private readonly outlineMaterial = new THREE.MeshBasicMaterial({
    color: OUTLINE_COLOR,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  private readonly outlineHoverMaterial = new THREE.MeshBasicMaterial({ color: OUTLINE_HOVER_COLOR, depthWrite: false });
  /** Back faces of a slightly larger copy: a soft halo around the silhouette. */
  private readonly rimMaterial = new THREE.MeshBasicMaterial({
    color: GLOW_COLOR,
    transparent: true,
    opacity: 0.35,
    side: THREE.BackSide,
    depthWrite: false,
  });

  constructor(
    private readonly looks: BlockLooks,
    private readonly geometries: ShapeGeometries,
  ) {
    this.group.name = 'ghosts';
  }

  private outlineFor(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.outlines.get(geometry);
    if (!g) {
      g = outlineGeometry(geometry);
      this.outlines.set(geometry, g);
    }
    return g;
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
        emissive: new THREE.Color(GLOW_COLOR),
        emissiveIntensity: GLOW_MIN,
      });
      const root = new THREE.Group();
      root.position.set(x + 0.5, y + 0.5, z + 0.5);
      const rim = new THREE.Mesh(overlay.geometry, this.rimMaterial);
      rim.scale.setScalar(RIM_SCALE);
      rim.renderOrder = 3;
      const mesh = new THREE.Mesh(overlay.geometry, materials);
      mesh.renderOrder = 4;
      const outline = new THREE.Mesh(this.outlineFor(overlay.geometry), this.outlineMaterial);
      outline.renderOrder = 5;
      root.add(rim, mesh, outline);
      const item: GhostMesh = { ghost, root, mesh, outline, rim, materials };
      this.items.push(item);
      this.byCell.set(keyOf(x, y, z), item);
      this.group.add(root);
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
    this.rimMaterial.opacity = 0.22 + pulse * 0.26;
    this.outlineMaterial.opacity = 0.8 + pulse * 0.2;
    const glow = GLOW_MIN + pulse * GLOW_PULSE;
    for (const item of this.items) {
      item.root.visible = !isSolid(item.ghost.cell);
      const hovered = item === this.hovered;
      const opacity = hovered ? HOVER_OPACITY : BASE_OPACITY + pulse * PULSE_OPACITY;
      for (const m of item.materials) {
        m.opacity = opacity;
        m.emissiveIntensity = hovered ? GLOW_MIN : glow;
      }
      item.outline.material = hovered ? this.outlineHoverMaterial : this.outlineMaterial;
      item.root.scale.setScalar(hovered ? 1 : 0.95 + pulse * 0.04);
    }
  }

  dispose(): void {
    this.clear();
    for (const g of this.outlines.values()) g.dispose();
    this.outlines.clear();
    this.outlineMaterial.dispose();
    this.outlineHoverMaterial.dispose();
    this.rimMaterial.dispose();
  }

  private clear(): void {
    for (const item of this.items) {
      this.group.remove(item.root);
      for (const m of item.materials) m.dispose();
    }
    this.items = [];
    this.byCell.clear();
    this.hovered = null;
  }
}
