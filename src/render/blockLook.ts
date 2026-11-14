import * as THREE from 'three';
import type { BlockKey, ContentRegistry, FaceName, ResolvedBlock } from '../core/types';
import { BOX_FACE_ORDER } from './faces';

/** Cached, registry-backed info about how a block looks. Owns the overlay textures it creates. */
export class BlockLooks {
  private readonly blocks = new Map<BlockKey, ResolvedBlock>();
  private readonly averageColors = new Map<BlockKey, THREE.Color>();
  private readonly canvasTextures = new Map<HTMLCanvasElement, THREE.CanvasTexture>();

  constructor(private readonly registry: ContentRegistry) {}

  block(key: BlockKey): ResolvedBlock {
    let b = this.blocks.get(key);
    if (!b) {
      b = this.registry.block(key);
      this.blocks.set(key, b);
    }
    return b;
  }

  face(key: BlockKey, face: FaceName): HTMLCanvasElement {
    return this.block(key).faces[face];
  }

  isGlow(key: BlockKey): boolean {
    const b = this.block(key);
    return Boolean(b.glowColor) || b.behaviors.includes('glow');
  }

  glowColor(key: BlockKey): THREE.Color {
    const b = this.block(key);
    return new THREE.Color(b.glowColor ?? '#fff3c4');
  }

  /** Average color of the top face, used for smash particles. */
  averageColor(key: BlockKey): THREE.Color {
    const cached = this.averageColors.get(key);
    if (cached) return cached;
    const color = sampleAverage(this.face(key, 'top')) ?? new THREE.Color('#ffd1dc');
    this.averageColors.set(key, color);
    return color;
  }

  /** Six textures in BoxGeometry material order, for overlay meshes (preview, bounce). */
  boxTextures(key: BlockKey): THREE.Texture[] {
    return BOX_FACE_ORDER.map((face) => this.textureFor(this.face(key, face)));
  }

  dispose(): void {
    for (const t of this.canvasTextures.values()) t.dispose();
    this.canvasTextures.clear();
    this.blocks.clear();
    this.averageColors.clear();
  }

  private textureFor(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    let t = this.canvasTextures.get(canvas);
    if (!t) {
      t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      this.canvasTextures.set(canvas, t);
    }
    return t;
  }
}

function sampleAverage(canvas: HTMLCanvasElement): THREE.Color | null {
  try {
    const probe = document.createElement('canvas');
    probe.width = 4;
    probe.height = 4;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, 4, 4);
    const data = ctx.getImageData(0, 0, 4, 4).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch {
    // Tainted or zero-sized canvases cannot be sampled; callers fall back to a pastel default.
    return null;
  }
}
