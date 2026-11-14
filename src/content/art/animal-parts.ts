/** Reusable friendly face features: round eyes, rosy cheeks, gentle smiles. */
import { circle, ellipse, noShadow, softShadow, type Ctx } from './canvas';

export const INK = '#3b2a40';
export const BLUSH = 'rgba(255, 120, 150, 0.45)';
export const PINK = '#ff9db5';

/** Big round eyes with two sparkles each: the core of "friendly". */
export function eyes(ctx: Ctx, y: number, spread = 22, r = 8.5, cx = 64): void {
  for (const x of [cx - spread, cx + spread]) {
    circle(ctx, x, y, r, INK);
    circle(ctx, x - r * 0.3, y - r * 0.35, r * 0.38, '#ffffff');
    circle(ctx, x + r * 0.35, y + r * 0.3, r * 0.16, '#ffffff');
  }
}

export function cheeks(ctx: Ctx, y: number, spread = 36): void {
  ellipse(ctx, 64 - spread, y, 10, 6.5, BLUSH);
  ellipse(ctx, 64 + spread, y, 10, 6.5, BLUSH);
}

export function smile(ctx: Ctx, y: number, r = 9, width = 4, cx = 64): void {
  ctx.beginPath();
  ctx.arc(cx, y - r * 0.4, r, Math.PI * 0.18, Math.PI * 0.82);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Cat / mouse style "w" mouth. */
export function catMouth(ctx: Ctx, y: number): void {
  ctx.beginPath();
  ctx.arc(57, y, 7, Math.PI * 0.1, Math.PI * 0.9);
  ctx.moveTo(78, y);
  ctx.arc(71, y, 7, Math.PI * 0.1, Math.PI * 0.9);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function whiskers(ctx: Ctx, y: number): void {
  ctx.strokeStyle = 'rgba(59, 42, 64, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(64 + side * 22, y);
    ctx.lineTo(64 + side * 46, y - 5);
    ctx.moveTo(64 + side * 22, y + 6);
    ctx.lineTo(64 + side * 46, y + 9);
  }
  ctx.stroke();
}

export function nostrils(ctx: Ctx, y: number, spread = 9, color = INK): void {
  ellipse(ctx, 64 - spread, y, 3.5, 4.5, color);
  ellipse(ctx, 64 + spread, y, 3.5, 4.5, color);
}

/** Rounded triangle ear pointing up (cats, pigs, horses). */
export function pointyEar(ctx: Ctx, x: number, y: number, size: number, fill: string, inner?: string): void {
  const draw = (s: number, color: string): void => {
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 1.3, x, y - s);
    ctx.quadraticCurveTo(x + s * 0.2, y - s * 1.3, x + s, y + s * 0.6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  draw(size, fill);
  if (inner) draw(size * 0.55, inner);
}

/** Soft rounded beak (triangle pointing down). */
export function beak(ctx: Ctx, y: number, w: number, h: number, fill: string): void {
  softShadow(ctx, 0.15, 2, 1);
  ctx.beginPath();
  ctx.moveTo(64 - w, y);
  ctx.quadraticCurveTo(64, y - 4, 64 + w, y);
  ctx.quadraticCurveTo(64 + 2, y + h, 64, y + h);
  ctx.quadraticCurveTo(64 - 2, y + h, 64 - w, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  noShadow(ctx);
}
