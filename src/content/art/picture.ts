/**
 * Small isometric picture of a group of blocks (build cards, blueprints) drawn
 * with each block's own face art and shape, so a child who cannot read sees
 * what to build. Browser only.
 */
import type { BlockKey, BlockShape, ContentRegistry, FaceName, Rotation } from '../../core/types';
import { drawIsoBlock, project, type Pt } from './iso';

export interface PictureBlock {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: BlockKey;
  readonly rot?: Rotation;
}

export interface PictureOptions<T extends PictureBlock = PictureBlock> {
  /** Draw these blocks washed out (e.g. earlier blueprint steps). */
  readonly faded?: (b: T) => boolean;
  /** Size the picture to fit these blocks instead (keeps step pictures the same scale). */
  readonly frame?: readonly PictureBlock[];
}

const PADDING = 0.12;
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]] as const;

/** Sort far-to-near so nearer blocks paint over farther ones. */
export function paintOrder<T extends { x: number; y: number; z: number }>(blocks: readonly T[]): T[] {
  return [...blocks].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.y - b.y || a.x - b.x);
}

function bounds(blocks: readonly PictureBlock[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of blocks) {
    for (const [dx, dy, dz] of CORNERS) {
      const p = project(b.x + dx, b.y + dy, b.z + dz);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

type Lookup = Pick<ContentRegistry, 'block'>;

function infoOf(registry: Lookup, key: BlockKey): { shape: BlockShape; faces: Partial<Record<FaceName, HTMLCanvasElement>> } {
  try {
    const b = registry.block(key);
    return { shape: b.shape ?? 'cube', faces: b.faces ?? {} };
  } catch {
    return { shape: 'cube', faces: {} };
  }
}

export function drawBlocksPicture<T extends PictureBlock>(
  blocks: readonly T[], registry: Lookup, size: number, options: PictureOptions<T> = {},
): HTMLCanvasElement {
  const px = Math.max(16, Math.round(size));
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx || blocks.length === 0) return canvas;

  const b = bounds(options.frame && options.frame.length > 0 ? options.frame : blocks);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const usable = px * (1 - PADDING * 2);
  const scale = usable / Math.max(w, h, 1e-6);
  const offX = (px - w * scale) / 2 - b.minX * scale;
  const offY = (px - h * scale) / 2 - b.minY * scale;
  const toScreen = (p: Pt): Pt => ({ x: p.x * scale + offX, y: p.y * scale + offY });

  // Soft ground shadow so the build feels grounded.
  ctx.fillStyle = 'rgba(40, 30, 70, 0.12)';
  ctx.beginPath();
  ctx.ellipse(px / 2, offY + h * scale - scale * 0.15, (w * scale) / 2, scale * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  const outline = Math.max(0.6, scale * 0.025);
  for (const block of paintOrder(blocks)) {
    const { shape, faces } = infoOf(registry, block.block);
    const veil = options.faded?.(block) ? 0.55 : 0;
    drawIsoBlock(ctx, [block.x, block.y, block.z], shape, block.rot ?? 0, (f) => faces[f] ?? null, toScreen, outline, veil);
  }
  return canvas;
}
