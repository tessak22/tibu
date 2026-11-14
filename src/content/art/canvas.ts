/** Canvas helpers shared by every art family. Browser only. */
import { FACE_SIZE } from '../constants';
import type { Params } from './params';
import type { Rng } from './random';
import { darken, lighten } from './color';

export type Ctx = CanvasRenderingContext2D;
export type Fill = string | CanvasGradient | CanvasPattern;

/** Everything a pattern needs to paint one 128x128 face. */
export interface PatternInput {
  readonly ctx: Ctx;
  readonly color: string;
  readonly accent: string;
  readonly params: Params;
  readonly rng: Rng;
}

export type PatternFn = (input: PatternInput) => void;

export const S = FACE_SIZE;
export const INSET = 5;
export const RADIUS = 20;

/** Rounded, friendly fonts that ship with common tablets; no web fonts needed. */
export const FONT_STACK =
  '"Arial Rounded MT Bold", "Nunito", "Varela Round", ui-rounded, "SF Pro Rounded", "Trebuchet MS", system-ui, sans-serif';

export function makeCanvas(size: number = S): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function context(canvas: HTMLCanvasElement): Ctx {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return ctx;
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: Fill): void {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Soft drop shadow for marks and features; call `noShadow` afterwards. */
export function softShadow(ctx: Ctx, alpha = 0.18, blur = 4, dy = 2): void {
  ctx.shadowColor = `rgba(40, 20, 50, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dy;
}

export function noShadow(ctx: Ctx): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * The soft toy-block base every face shares: a slightly darker rounded rim
 * and a gently lit panel. `rim` controls how visible the block edge is.
 */
export function drawBase(ctx: Ctx, color: string, rim = 0.16): void {
  ctx.fillStyle = darken(color, rim);
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, lighten(color, 0.12));
  g.addColorStop(1, color);
  fillRoundRect(ctx, INSET, INSET, S - INSET * 2, S - INSET * 2, RADIUS, g);
}

/** Restricts drawing to the inner panel. Pair with ctx.restore(). */
export function clipPanel(ctx: Ctx): void {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, INSET, INSET, S - INSET * 2, S - INSET * 2, RADIUS);
  ctx.clip();
}

/** Plastic-like sheen in the top-left corner; drawn last. */
export function drawGloss(ctx: Ctx, strength = 0.22): void {
  clipPanel(ctx);
  const g = ctx.createRadialGradient(30, 26, 2, 30, 26, 70);
  g.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  ctx.beginPath();
  roundRectPath(ctx, INSET + 1, INSET + 1, S - INSET * 2 - 2, S - INSET * 2 - 2, RADIUS - 1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Big, soft, outlined text centered at (x, y). */
export function drawText(ctx: Ctx, text: string, x: number, y: number, px: number, fill: string, outline: string): void {
  ctx.font = `bold ${px}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  softShadow(ctx, 0.22, 5, 3);
  ctx.lineWidth = Math.max(4, px * 0.12);
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  noShadow(ctx);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Tiny four-point sparkle. */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = fill;
  ctx.fill();
}

