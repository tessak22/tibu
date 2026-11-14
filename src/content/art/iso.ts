/**
 * Isometric drawing of shaped blocks with their own face art. Used by tray
 * icons and by card / blueprint pictures. Browser only (canvas).
 */
import type { BlockShape, FaceName, Rotation } from '../../core/types';
import { dot, visiblePolys, type ShapePoly, type V3 } from './shape-geometry';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

const COS30 = Math.cos(Math.PI / 6);

/** Isometric projection in unit-cube space: +x right-down, +z left-down, +y up. */
export function project(x: number, y: number, z: number): Pt {
  return { x: (x - z) * COS30, y: (x + z) * 0.5 - y };
}

export type FaceLookup = (face: FaceName) => HTMLCanvasElement | null;

/** Darker for faces turned away from the light (top-left-front). */
export function shadeFor(normal: V3): number {
  const up = Math.max(0, normal[1]);
  return (1 - up) * (0.08 + 0.1 * Math.max(0, normal[0])) + (normal[1] < 0 ? 0.25 : 0);
}

function tracePoly(ctx: CanvasRenderingContext2D, pts: readonly Pt[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function drawPoly(ctx: CanvasRenderingContext2D, poly: ShapePoly, faceOf: FaceLookup, toScreen: (p: Pt) => Pt, outline: number, veil: number): void {
  const screen = (v: V3): Pt => toScreen(project(v[0], v[1], v[2]));
  const pts = poly.pts.map(screen);
  const { o, u, v } = poly.tex;
  const so = screen(o);
  const su = screen([o[0] + u[0], o[1] + u[1], o[2] + u[2]]);
  const sv = screen([o[0] + v[0], o[1] + v[1], o[2] + v[2]]);
  const art = faceOf(poly.face);
  const size = art?.width || 1;
  const [s0, s1] = poly.slice ?? [0, 1];
  ctx.save();
  tracePoly(ctx, pts);
  ctx.clip();
  ctx.setTransform((su.x - so.x) / size, (su.y - so.y) / size, (sv.x - so.x) / size, (sv.y - so.y) / size, so.x, so.y);
  if (art) ctx.drawImage(art, s0 * art.width, 0, Math.max(1, (s1 - s0) * art.width), art.height, -0.5, -0.5, size + 1, size + 1);
  else {
    ctx.fillStyle = '#d8d0c4';
    ctx.fillRect(-1, -1, size + 2, size + 2);
  }
  const shade = shadeFor(poly.normal);
  if (shade > 0) {
    ctx.fillStyle = `rgba(30, 20, 60, ${shade})`;
    ctx.fillRect(-1, -1, size + 2, size + 2);
  }
  ctx.restore();
  ctx.save();
  tracePoly(ctx, pts);
  if (veil > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${veil})`;
    ctx.fill();
  }
  ctx.lineWidth = outline;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40, 30, 70, 0.3)';
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws one block of any shape at cell position `at`. Faces not facing the viewer
 * are skipped. `veil` (0..1) washes the block out with white (earlier build steps).
 */
export function drawIsoBlock(
  ctx: CanvasRenderingContext2D, at: V3, shape: BlockShape, rot: Rotation, faceOf: FaceLookup,
  toScreen: (p: Pt) => Pt, outline = 1, veil = 0,
): void {
  for (const poly of visiblePolys(shape, rot, at)) drawPoly(ctx, poly, faceOf, toScreen, outline, veil);
}

/** Depth of a cell for painter's ordering (larger is nearer the viewer). */
export const cellDepth = (x: number, y: number, z: number): number => dot([x, y, z], [1, 1, 1]);
