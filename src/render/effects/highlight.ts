import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BlockKey, Cell, Mode, Rotation } from '../../core/types';
import type { BlockLooks } from '../blockLook';
import { overlayMaterials, type ShapeGeometries } from '../shapeGeometry';
import { isPart } from '../shapes';

const BUILD_COLOR = '#7ff0c9';
const SMASH_COLOR = '#ff8fa3';
const BUILD_HALO = '#ffffff';
const SMASH_HALO = '#ffe066';

/**
 * Kid-friendly target highlight: a soft, rounded, pulsing bubble around the target cell.
 * In build mode a translucent preview of the selected block (parts rotated as they will be placed)
 * sits inside it.
 * In smash mode the bubble is coral and wraps the block that will pop.
 */
export class Highlight {
  readonly group = new THREE.Group();
  private readonly shellGeometry = new RoundedBoxGeometry(1.14, 1.14, 1.14, 3, 0.2);
  private readonly shellMaterial = new THREE.MeshBasicMaterial({
    color: BUILD_COLOR,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly shell: THREE.Mesh;
  /** Back-face halo drawn slightly larger: reads as a soft, thick outline around the target. */
  private readonly haloMaterial = new THREE.MeshBasicMaterial({
    color: BUILD_HALO,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly halo: THREE.Mesh;
  private readonly previewGeometry = new RoundedBoxGeometry(0.92, 0.92, 0.92, 2, 0.08);
  private previewMaterials: THREE.MeshLambertMaterial[] = [];
  private readonly preview: THREE.Mesh;
  private mode: Mode = 'build';
  private selected: BlockKey | null = null;
  private rotation: Rotation = 0;
  private time = 0;

  constructor(
    private readonly looks: BlockLooks,
    private readonly geometries: ShapeGeometries,
  ) {
    this.shell = new THREE.Mesh(this.shellGeometry, this.shellMaterial);
    this.shell.renderOrder = 5;
    this.halo = new THREE.Mesh(this.shellGeometry, this.haloMaterial);
    this.halo.scale.setScalar(1.12);
    this.halo.renderOrder = 3;
    this.preview = new THREE.Mesh(this.previewGeometry, []);
    this.preview.renderOrder = 4;
    this.group.add(this.halo, this.preview, this.shell);
    this.group.visible = false;
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    const color = mode === 'smash' ? SMASH_COLOR : BUILD_COLOR;
    this.shellMaterial.color.set(color);
    this.haloMaterial.color.set(mode === 'smash' ? SMASH_HALO : BUILD_HALO);
    this.preview.visible = mode === 'build' && this.previewMaterials.length > 0;
  }

  setSelected(block: BlockKey): void {
    if (block === this.selected) return;
    this.selected = block;
    this.disposePreviewMaterials();
    const part = isPart(this.looks.shape(block));
    const overlay = this.geometries.get(this.looks.shape(block), this.rotation);
    const textures = part ? this.looks.texturesIn(block, overlay.faceOrder) : this.looks.boxTextures(block);
    this.previewMaterials = overlayMaterials(textures, overlay, { transparent: true, opacity: 0.6, depthWrite: false });
    this.preview.material = this.previewMaterials;
    this.applyPreviewGeometry();
    this.preview.visible = this.mode === 'build';
  }

  /** Rotation the selected part will be placed with (follows the camera yaw). */
  setRotation(rot: Rotation): void {
    if (rot === this.rotation) return;
    this.rotation = rot;
    this.applyPreviewGeometry();
  }

  private applyPreviewGeometry(): void {
    const part = this.selected !== null && isPart(this.looks.shape(this.selected));
    this.preview.geometry = part
      ? this.geometries.get(this.looks.shape(this.selected as BlockKey), this.rotation).geometry
      : this.previewGeometry;
    this.preview.scale.setScalar(part ? 0.94 : 1);
  }

  show(cell: Cell): void {
    this.group.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
    this.group.visible = true;
    this.time = 0;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** The visible highlight pulses, so it needs smooth frames. */
  isAnimating(): boolean {
    return this.group.visible;
  }

  update(dt: number, reducedMotion: boolean): void {
    if (!this.group.visible) return;
    this.time += dt;
    const pulse = reducedMotion ? 0 : Math.sin(this.time * 7) * 0.5 + 0.5;
    const base = this.mode === 'smash' ? 0.42 : 0.3;
    this.shellMaterial.opacity = base + pulse * 0.2;
    this.shell.scale.setScalar(1 + pulse * 0.05);
    this.halo.scale.setScalar(1.12 + pulse * 0.06);
    this.preview.rotation.y = reducedMotion ? 0 : Math.sin(this.time * 2.5) * 0.12;
  }

  dispose(): void {
    this.disposePreviewMaterials();
    this.shellGeometry.dispose();
    this.previewGeometry.dispose();
    this.shellMaterial.dispose();
    this.haloMaterial.dispose();
  }

  private disposePreviewMaterials(): void {
    for (const m of this.previewMaterials) m.dispose();
    this.previewMaterials = [];
  }
}
