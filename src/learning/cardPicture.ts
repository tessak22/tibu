/**
 * Draws a build card as a small isometric picture of its blocks, using each
 * block's own face art, so a child who cannot read sees what to build.
 */
import type { BlockKey, ContentRegistry, FaceName } from '../core/types';
import type { PatternBlock } from './cards';

interface Pt {
  readonly x: number;
  readonly y: number;
}

const COS30 = Math.cos(Math.PI / 6);
const PADDING = 0.12;

/** Isometric projection in unit-cube space: +x right-down, +z left-down, +y up. */
function project(x: number, y: number, z: number): Pt {
  return { x: (x - z) * COS30, y: (x + z) * 0.5 - y };
}

interface Face {
  readonly name: FaceName;
  readonly origin: readonly [number, number, number];
  readonly u: readonly [number, number, number];
  readonly v: readonly [number, number, number];
  readonly shade: number;
}

/** Visible faces of a unit cube at (0,0,0): top, east (+x), south (+z). */
const FACES: readonly Face[] = [
  { name: 'top', origin: [0, 1, 0], u: [1, 1, 0], v: [0, 1, 1], shade: 0 },
  { name: 'east', origin: [1, 1, 1], u: [1, 1, 0], v: [1, 0, 1], shade: 0.18 },
  { name: 'south', origin: [0, 1, 1], u: [1, 1, 1], v: [0, 0, 1], shade: 0.08 },
];

/** Sort far-to-near so nearer cubes paint over farther ones. */
export function paintOrder(blocks: readonly PatternBlock[]): PatternBlock[] {
  return [...blocks].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.y - b.y || a.x - b.x);
}

function bounds(blocks: readonly PatternBlock[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of blocks) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]] as const) {
      const p = project(b.x + dx, b.y + dy, b.z + dz);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function drawCube(ctx: CanvasRenderingContext2D, b: PatternBlock, faceOf: (key: BlockKey, face: FaceName) => HTMLCanvasElement | null, toScreen: (p: Pt) => Pt): void {
  for (const face of FACES) {
    const [ox, oy, oz] = face.origin;
    const o = toScreen(project(b.x + ox, b.y + oy, b.z + oz));
    const u = toScreen(project(b.x + face.u[0], b.y + face.u[1], b.z + face.u[2]));
    const v = toScreen(project(b.x + face.v[0], b.y + face.v[1], b.z + face.v[2]));
    const art = faceOf(b.block, face.name);
    const s = art?.width || 1;
    ctx.save();
    ctx.setTransform((u.x - o.x) / s, (u.y - o.y) / s, (v.x - o.x) / s, (v.y - o.y) / s, o.x, o.y);
    if (art) ctx.drawImage(art, 0, 0, s, s);
    else {
      ctx.fillStyle = '#d8d0c4';
      ctx.fillRect(0, 0, s, s);
    }
    if (face.shade > 0) {
      ctx.fillStyle = `rgba(30, 20, 60, ${face.shade})`;
      ctx.fillRect(0, 0, s, s);
    }
    ctx.lineWidth = s * 0.025;
    ctx.strokeStyle = 'rgba(40, 30, 70, 0.35)';
    ctx.strokeRect(0, 0, s, s);
    ctx.restore();
  }
}

export function drawCardPicture(
  blocks: readonly PatternBlock[], registry: Pick<ContentRegistry, 'block'>, size: number,
): HTMLCanvasElement {
  const px = Math.max(16, Math.round(size));
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx || blocks.length === 0) return canvas;

  const b = bounds(blocks);
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

  const faceOf = (key: BlockKey, face: FaceName): HTMLCanvasElement | null => {
    try {
      return registry.block(key).faces[face] ?? null;
    } catch {
      return null;
    }
  };
  for (const block of paintOrder(blocks)) drawCube(ctx, block, faceOf, toScreen);
  return canvas;
}
