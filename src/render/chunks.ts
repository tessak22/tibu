import * as THREE from 'three';
import type { Cell } from '../core/types';
import { cellIndex, inBounds } from '../world/grid';
import { CHUNK_COUNT, chunkOrigin, chunksAffectedBy } from './chunkMath';
import { meshChunk, type MeshArrays } from './chunkMesher';
import type { TextureAtlas } from './atlas';
import type { BlockLooks } from './blockLook';
import type { VoxelMirror } from './voxelMirror';

interface ChunkMeshes {
  solid: THREE.Mesh | null;
  glow: THREE.Mesh | null;
}

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

/**
 * Owns the merged block meshes (3x3 chunk columns). Only chunks marked dirty by a world change
 * are rebuilt. Glowing blocks go to a separate emissive mesh per chunk.
 */
export class ChunkRenderer {
  readonly group = new THREE.Group();
  readonly solidMaterial: THREE.MeshLambertMaterial;
  readonly glowMaterial: THREE.MeshLambertMaterial;
  private readonly meshes: ChunkMeshes[] = Array.from({ length: CHUNK_COUNT }, () => ({ solid: null, glow: null }));
  private readonly dirty = new Set<number>();
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
    this.offAtlas = atlas.onReplace((t) => {
      this.solidMaterial.map = t;
      this.glowMaterial.map = t;
      this.glowMaterial.emissiveMap = t;
      this.solidMaterial.needsUpdate = true;
      this.glowMaterial.needsUpdate = true;
    });
  }

  markAll(): void {
    for (let i = 0; i < CHUNK_COUNT; i++) this.dirty.add(i);
  }

  markCell(c: Cell): void {
    for (const i of chunksAffectedBy(c)) this.dirty.add(i);
  }

  /** Temporarily hide a cell (e.g. while an overlay animates it). */
  setHidden(c: Cell, hidden: boolean): void {
    if (!inBounds(c)) return;
    const key = cellIndex(c.x, c.y, c.z);
    if (hidden === this.hidden.has(key)) return; // No change: no rebuild.
    if (hidden) this.hidden.add(key);
    else this.hidden.delete(key);
    this.markCell(c);
  }

  setShadows(on: boolean): void {
    for (const m of this.meshes) {
      for (const mesh of [m.solid, m.glow]) {
        if (!mesh) continue;
        mesh.castShadow = on;
        mesh.receiveShadow = on;
      }
    }
    this.shadows = on;
  }

  /** Rebuild every dirty chunk. Returns true when anything changed. */
  update(): boolean {
    if (this.dirty.size === 0 && this.builtAtlasVersion === this.atlas.version) return false;
    if (this.builtAtlasVersion !== this.atlas.version) this.markAll();
    // Building may add atlas tiles and grow the atlas; if so, rebuild everything once more.
    for (let attempt = 0; attempt < 3; attempt++) {
      const version = this.atlas.version;
      const pending = [...this.dirty];
      this.dirty.clear();
      for (const i of pending) this.rebuild(i);
      if (this.atlas.version === version) break;
      this.markAll();
    }
    this.builtAtlasVersion = this.atlas.version;
    this.atlas.flush();
    return true;
  }

  dispose(): void {
    this.offAtlas();
    for (const m of this.meshes) this.disposeChunk(m);
    this.solidMaterial.dispose();
    this.glowMaterial.dispose();
  }

  private rebuild(index: number): void {
    const grid = this.mirror.grid;
    const arrays = meshChunk({
      idAt: (x, y, z) => grid.idAt(x, y, z),
      origin: chunkOrigin(index),
      uvRect: (id, face) => {
        const key = grid.keyOf(id);
        return key ? this.atlas.uvFor(this.looks.face(key, face)) : [0, 0, 0, 0];
      },
      isGlow: (id) => {
        const key = grid.keyOf(id);
        return key ? this.looks.isGlow(key) : false;
      },
      hidden: this.hidden,
    });
    const slot = this.meshes[index];
    this.disposeChunk(slot);
    slot.solid = this.makeMesh(toGeometry(arrays.solid), this.solidMaterial, `chunk-${index}`);
    slot.glow = this.makeMesh(toGeometry(arrays.glow), this.glowMaterial, `chunk-${index}-glow`);
  }

  private makeMesh(geometry: THREE.BufferGeometry | null, material: THREE.Material, name: string): THREE.Mesh | null {
    if (!geometry) return null;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = this.shadows;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    return mesh;
  }

  private disposeChunk(slot: ChunkMeshes): void {
    for (const mesh of [slot.solid, slot.glow]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    slot.solid = null;
    slot.glow = null;
  }
}
