import * as THREE from 'three';
import type { Cell, WorldSize } from '../core/types';
import { isBigWorld } from '../input/orbit';
import { ChunkLayout } from './chunkMath';
import { meshChunk, type MeshArrays } from './chunkMesher';
import type { TextureAtlas } from './atlas';
import type { BlockLooks } from './blockLook';
import { cellKey } from './voxelGrid';
import type { VoxelMirror } from './voxelMirror';

interface ChunkMeshes {
  solid: THREE.Mesh | null;
  glow: THREE.Mesh | null;
  glass: THREE.Mesh | null;
  built: boolean;
}

/** Background (lazy) chunk building may use this much of a frame. */
export const BUILD_BUDGET_MS = 5;

function toGeometry(arrays: MeshArrays): THREE.BufferGeometry | null {
  if (arrays.indices.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(arrays.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3));
  g.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
  g.computeBoundingSphere();
  return g;
}

const emptySlot = (): ChunkMeshes => ({ solid: null, glow: null, glass: null, built: false });

/**
 * Owns the merged block meshes, one set per chunk column. Edits rebuild their chunks at once
 * ("urgent"); a freshly loaded big world builds lazily, nearest chunks first, a few per frame.
 * Three.js frustum-culls each chunk mesh by its bounding sphere; `cull` also hides far chunks.
 */
export class ChunkRenderer {
  readonly group = new THREE.Group();
  readonly solidMaterial: THREE.MeshLambertMaterial;
  readonly glowMaterial: THREE.MeshLambertMaterial;
  readonly glassMaterial: THREE.MeshLambertMaterial;
  private layout = new ChunkLayout();
  private meshes: ChunkMeshes[] = [];
  private readonly urgent = new Set<number>();
  private readonly background = new Set<number>();
  private readonly hidden = new Set<number>();
  private builtAtlasVersion = -1;
  private shadows = true;
  private readonly offAtlas: () => void;

  constructor(
    private readonly mirror: VoxelMirror,
    private readonly atlas: TextureAtlas,
    private readonly looks: BlockLooks,
  ) {
    this.group.name = 'blocks';
    this.solidMaterial = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true });
    this.glowMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      emissiveMap: atlas.texture,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 0.85,
      vertexColors: true,
    });
    // Magnet-tile panes: candy-glass, lightly lit from within so they stay bright.
    this.glassMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.14,
    });
    this.offAtlas = atlas.onReplace((t) => {
      for (const m of [this.solidMaterial, this.glowMaterial, this.glassMaterial]) {
        m.map = t;
        m.needsUpdate = true;
      }
      this.glowMaterial.emissiveMap = t;
    });
    this.setSize(mirror.size);
  }

  /** Re-lays out chunks for a world size (drops all meshes). */
  setSize(size: WorldSize): void {
    for (const m of this.meshes) this.disposeChunk(m);
    this.layout = new ChunkLayout(size);
    this.meshes = Array.from({ length: this.layout.count }, emptySlot);
    this.urgent.clear();
    this.background.clear();
    this.hidden.clear();
  }

  get chunkLayout(): ChunkLayout {
    return this.layout;
  }

  /** Everything needs (re)building: little worlds at once, big worlds lazily. */
  markAll(): void {
    const target = isBigWorld(this.layout.size) ? this.background : this.urgent;
    for (let i = 0; i < this.layout.count; i++) target.add(i);
  }

  markCell(c: Cell): void {
    for (const i of this.layout.affectedBy(c)) {
      this.urgent.add(i);
      this.background.delete(i);
    }
  }

  /** Chunks still waiting for their first lazy build. */
  pendingCount(): number {
    return this.background.size + this.urgent.size;
  }

  /** Temporarily hide a cell (e.g. while an overlay animates it). */
  setHidden(c: Cell, hidden: boolean): void {
    const size = this.layout.size;
    if (c.x < 0 || c.y < 0 || c.z < 0 || c.x >= size.x || c.y >= size.y || c.z >= size.z) return;
    const key = cellKey(size, c.x, c.y, c.z);
    if (hidden === this.hidden.has(key)) return; // No change: no rebuild.
    if (hidden) this.hidden.add(key);
    else this.hidden.delete(key);
    this.markCell(c);
  }

  setShadows(on: boolean): void {
    this.shadows = on;
    for (const m of this.meshes) {
      for (const mesh of [m.solid, m.glow]) {
        if (!mesh) continue;
        mesh.castShadow = on;
        mesh.receiveShadow = on;
      }
    }
  }

  /**
   * Rebuilds urgent chunks, then lazy ones nearest `focus` within the time budget
   * (all of them when `force`). Returns true when any mesh changed.
   */
  update(focus: { x: number; z: number } | null = null, force = false, budgetMs = BUILD_BUDGET_MS): boolean {
    if (this.builtAtlasVersion !== this.atlas.version) this.markBuiltUrgent();
    if (this.urgent.size === 0 && this.background.size === 0) return false;
    const start = now();
    // Building may add atlas tiles and grow the atlas; if so, rebuild already built chunks once more.
    for (let attempt = 0; attempt < 3; attempt++) {
      const version = this.atlas.version;
      const pending = [...this.urgent];
      this.urgent.clear();
      for (const i of pending) this.rebuild(i);
      if (attempt === 0) this.buildBackground(focus, force, start, budgetMs);
      if (this.atlas.version === version) break;
      this.markBuiltUrgent();
    }
    this.builtAtlasVersion = this.atlas.version;
    this.atlas.flush();
    return true;
  }

  /** Hides chunk columns farther than `maxDistance` (horizontally) from the camera. */
  cull(camera: { readonly x: number; readonly z: number }, maxDistance: number): void {
    const reach = maxDistance + this.layout.width * 0.75;
    const reach2 = reach * reach;
    const layout = this.layout;
    // Runs every frame in big worlds: no allocations.
    for (let i = 0; i < this.meshes.length; i++) {
      const slot = this.meshes[i] as ChunkMeshes;
      const dx = layout.centerX(i) - camera.x;
      const dz = layout.centerZ(i) - camera.z;
      const visible = dx * dx + dz * dz <= reach2;
      if (slot.solid) slot.solid.visible = visible;
      if (slot.glow) slot.glow.visible = visible;
      if (slot.glass) slot.glass.visible = visible;
    }
  }

  dispose(): void {
    this.offAtlas();
    for (const m of this.meshes) this.disposeChunk(m);
    this.solidMaterial.dispose();
    this.glowMaterial.dispose();
    this.glassMaterial.dispose();
  }

  private markBuiltUrgent(): void {
    this.meshes.forEach((m, i) => {
      if (m.built) this.urgent.add(i);
    });
  }

  private buildBackground(focus: { x: number; z: number } | null, force: boolean, start: number, budgetMs: number): void {
    if (this.background.size === 0) return;
    const order = [...this.background];
    if (focus) {
      const d = (i: number): number => {
        const c = this.layout.center(i);
        return (c.x - focus.x) ** 2 + (c.z - focus.z) ** 2;
      };
      order.sort((a, b) => d(a) - d(b));
    }
    for (const i of order) {
      this.background.delete(i);
      this.rebuild(i);
      if (!force && now() - start >= budgetMs) break;
    }
  }

  private rebuild(index: number): void {
    const grid = this.mirror.grid;
    const looks = this.looks;
    const arrays = meshChunk({
      idAt: (x, y, z) => grid.idAt(x, y, z),
      rotAt: (x, y, z) => grid.rotAt(x, y, z),
      origin: this.layout.origin(index),
      size: this.layout.size,
      width: this.layout.width,
      uvRect: (id, face) => {
        const key = grid.keyOf(id);
        return key ? this.atlas.uvFor(looks.face(key, face)) : [0, 0, 0, 0];
      },
      isGlow: (id) => {
        const key = grid.keyOf(id);
        return key ? looks.isGlow(key) : false;
      },
      isTranslucent: (id) => {
        const key = grid.keyOf(id);
        return key ? looks.isTranslucent(key) : false;
      },
      shapeOf: (id) => {
        const key = grid.keyOf(id);
        return key ? looks.shape(key) : 'cube';
      },
      hidden: this.hidden,
    });
    const slot = this.meshes[index];
    this.disposeChunk(slot);
    slot.built = true; // After disposeChunk, which resets it.
    slot.solid = this.makeMesh(toGeometry(arrays.solid), this.solidMaterial, `chunk-${index}`, this.shadows);
    slot.glow = this.makeMesh(toGeometry(arrays.glow), this.glowMaterial, `chunk-${index}-glow`, this.shadows);
    slot.glass = this.makeMesh(toGeometry(arrays.glass), this.glassMaterial, `chunk-${index}-glass`, false);
    if (slot.glass) slot.glass.renderOrder = 2;
  }

  private makeMesh(
    geometry: THREE.BufferGeometry | null,
    material: THREE.Material,
    name: string,
    shadows: boolean,
  ): THREE.Mesh | null {
    if (!geometry) return null;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows || material === this.glassMaterial;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    return mesh;
  }

  private disposeChunk(slot: ChunkMeshes): void {
    for (const mesh of [slot.solid, slot.glow, slot.glass]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    slot.solid = null;
    slot.glow = null;
    slot.glass = null;
    slot.built = false;
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
