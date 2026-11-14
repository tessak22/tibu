import * as THREE from 'three';
import type { UvRect } from './chunkMesher';
import { ATLAS_SIZES, capacity, sizeFor, slotPixel, slotUv } from './atlasLayout';
import { drawTile } from './tileArt';

/**
 * Incremental texture atlas built from the registry's per-face canvases.
 * Tiles are added on first use (so a block from a not-yet-used pack still works).
 * When full, the atlas grows; `version` changes and every chunk must be re-meshed.
 */
export class TextureAtlas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number = ATLAS_SIZES[0];
  private readonly slots = new Map<CanvasImageSource, number>();
  private readonly sources: CanvasImageSource[] = [];
  private textureValue: THREE.CanvasTexture;
  private versionValue = 0;
  private dirty = false;
  private readonly onTextureReplaced = new Set<(t: THREE.Texture) => void>();

  constructor(private readonly maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.makeContext(this.canvas, this.size);
    this.textureValue = this.makeTexture();
  }

  get texture(): THREE.Texture {
    return this.textureValue;
  }

  /** Increments whenever previously returned UVs become invalid. */
  get version(): number {
    return this.versionValue;
  }

  /** Subscribe to texture replacement (after growth). */
  onReplace(listener: (t: THREE.Texture) => void): () => void {
    this.onTextureReplaced.add(listener);
    return () => this.onTextureReplaced.delete(listener);
  }

  uvFor(source: CanvasImageSource): UvRect {
    let slot = this.slots.get(source);
    if (slot === undefined) slot = this.add(source);
    return slotUv(slot, this.size);
  }

  /** Upload pending drawing to the GPU. Call once per frame. */
  flush(): void {
    if (!this.dirty) return;
    this.textureValue.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    this.textureValue.dispose();
    this.onTextureReplaced.clear();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  private add(source: CanvasImageSource): number {
    const slot = this.sources.length;
    if (slot >= capacity(this.size)) {
      const next = sizeFor(slot + 1);
      // Atlas is completely full: reuse slot 0 rather than failing (never expected in practice).
      if (next === null) return 0;
      this.grow(next);
    }
    this.sources.push(source);
    this.slots.set(source, slot);
    const { x, y } = slotPixel(slot, this.size);
    drawTile(this.ctx, source, x, y);
    this.dirty = true;
    return slot;
  }

  private grow(size: number): void {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.ctx = this.makeContext(this.canvas, size);
    this.sources.forEach((source, slot) => {
      const { x, y } = slotPixel(slot, size);
      drawTile(this.ctx, source, x, y);
    });
    const old = this.textureValue;
    this.textureValue = this.makeTexture();
    old.dispose();
    this.versionValue += 1;
    for (const listener of this.onTextureReplaced) listener(this.textureValue);
  }

  private makeContext(canvas: HTMLCanvasElement, size: number): CanvasRenderingContext2D {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tibu: 2D canvas is not available for the texture atlas');
    ctx.imageSmoothingEnabled = true;
    return ctx;
  }

  private makeTexture(): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = Math.min(4, this.maxAnisotropy);
    t.needsUpdate = true;
    return t;
  }
}
