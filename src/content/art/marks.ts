/** Friendly rounded shape marks (shapes pack and color-blind marks). Browser only. */
import type { MarkName } from '../constants';
import { makeCanvas, context, noShadow, softShadow, type Ctx } from './canvas';

type PathFn = (ctx: Ctx) => void;

function polygon(sides: number, radius = 1, rotation = -Math.PI / 2, dy = 0): PathFn {
  return (ctx) => {
    for (let i = 0; i < sides; i++) {
      const a = rotation + (i * Math.PI * 2) / sides;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius + dy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
}

function star(points: number, inner: number): PathFn {
  return (ctx) => {
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const r = i % 2 === 0 ? 1 : inner;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + 0.05);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + 0.05);
    }
    ctx.closePath();
  };
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function disc(ctx: Ctx, x: number, y: number, r: number, ccw = false): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2, ccw);
  ctx.closePath();
}

const PATHS: Record<Exclude<MarkName, 'moon'>, PathFn> = {
  circle: (ctx) => disc(ctx, 0, 0, 0.95),
  oval: (ctx) => ctx.ellipse(0, 0, 1, 0.66, 0, 0, Math.PI * 2),
  ring: (ctx) => {
    disc(ctx, 0, 0, 0.95);
    disc(ctx, 0, 0, 0.5, true);
  },
  square: (ctx) => rr(ctx, -0.8, -0.8, 1.6, 1.6, 0.16),
  rectangle: (ctx) => rr(ctx, -1, -0.58, 2, 1.16, 0.14),
  triangle: polygon(3, 1.05, -Math.PI / 2, 0.15),
  pentagon: polygon(5, 0.98, -Math.PI / 2, 0.04),
  hexagon: polygon(6, 0.98, 0),
  diamond: (ctx) => {
    ctx.moveTo(0, -1);
    ctx.lineTo(0.72, 0);
    ctx.lineTo(0, 1);
    ctx.lineTo(-0.72, 0);
    ctx.closePath();
  },
  star: star(5, 0.48),
  heart: (ctx) => {
    ctx.moveTo(0, 0.92);
    ctx.bezierCurveTo(-0.2, 0.75, -1.02, 0.25, -0.98, -0.3);
    ctx.bezierCurveTo(-0.95, -0.8, -0.3, -1.0, 0, -0.5);
    ctx.bezierCurveTo(0.3, -1.0, 0.95, -0.8, 0.98, -0.3);
    ctx.bezierCurveTo(1.02, 0.25, 0.2, 0.75, 0, 0.92);
    ctx.closePath();
  },
  cross: (ctx) => {
    rr(ctx, -0.32, -0.95, 0.64, 1.9, 0.2);
    rr(ctx, -0.95, -0.32, 1.9, 0.64, 0.2);
  },
  cloud: (ctx) => {
    disc(ctx, -0.48, 0.12, 0.42);
    disc(ctx, 0.05, -0.18, 0.55);
    disc(ctx, 0.55, 0.15, 0.4);
    rr(ctx, -0.9, 0.05, 1.85, 0.5, 0.25);
  },
  drop: (ctx) => {
    ctx.moveTo(0, -1);
    ctx.bezierCurveTo(0.25, -0.6, 0.72, -0.15, 0.72, 0.3);
    ctx.arc(0, 0.3, 0.72, 0, Math.PI, false);
    ctx.bezierCurveTo(-0.72, -0.15, -0.25, -0.6, 0, -1);
    ctx.closePath();
  },
  flower: (ctx) => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      disc(ctx, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.44);
    }
    disc(ctx, 0, 0, 0.45);
  },
};

function drawMoon(ctx: Ctx, cx: number, cy: number, r: number, fill: string): void {
  const size = Math.ceil(r * 2.6);
  const tmp = makeCanvas(size);
  const t = context(tmp);
  const c = size / 2;
  t.fillStyle = fill;
  t.beginPath();
  t.arc(c, c, r, 0, Math.PI * 2);
  t.fill();
  t.globalCompositeOperation = 'destination-out';
  t.beginPath();
  t.arc(c + r * 0.48, c - r * 0.28, r * 0.82, 0, Math.PI * 2);
  t.fill();
  softShadow(ctx);
  ctx.drawImage(tmp, cx - c, cy - c);
  noShadow(ctx);
}

/** Draws a mark centered at (cx, cy) with radius r (pixels). */
export function drawMark(ctx: Ctx, mark: MarkName, cx: number, cy: number, r: number, fill: string): void {
  if (mark === 'moon') {
    drawMoon(ctx, cx, cy, r, fill);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.translate(cx, cy);
  ctx.scale(r, r);
  PATHS[mark](ctx);
  ctx.restore();
  softShadow(ctx);
  ctx.fillStyle = fill;
  ctx.fill('nonzero');
  noShadow(ctx);
  // A same-color stroke with round joins softens every corner.
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, r * 0.2);
  ctx.strokeStyle = fill;
  if (mark !== 'ring') ctx.stroke();
}
