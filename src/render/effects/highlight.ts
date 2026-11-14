import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BlockKey, Cell, Mode } from '../../core/types';
import type { BlockLooks } from '../blockLook';

const BUILD_COLOR = '#7ff0c9';
const SMASH_COLOR = '#ff8fa3';
const BUILD_HALO = '#ffffff';
const SMASH_HALO = '#ffe066';

/**
 * Kid-friendly target highlight: a soft, rounded, pulsing bubble around the target cell.
 * In build mode a translucent preview of the selected block sits inside it.
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
  private time = 0;

  constructor(private readonly looks: BlockLooks) {
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
    const color = mode === 'build' ? BUILD_COLOR : SMASH_COLOR;
    this.shellMaterial.color.set(color);
    this.haloMaterial.color.set(mode === 'build' ? BUILD_HALO : SMASH_HALO);
    this.preview.visible = mode === 'build' && this.previewMaterials.length > 0;
  }

  setSelected(block: BlockKey): void {
    if (block === this.selected) return;
    this.selected = block;
    this.disposePreviewMaterials();
    this.previewMaterials = this.looks.boxTextures(block).map(
      (map) => new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.preview.material = this.previewMaterials;
    this.preview.visible = this.mode === 'build';
  }

  show(cell: Cell): void {
    this.group.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
    this.group.visible = true;
    this.time = 0;
  }

  hide(): void {
    this.group.visible = false;
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
