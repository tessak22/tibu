/** Building patterns: bricks, planks, window, door, roof, glass, lamp, star-shape. */
import type { PatternName } from '../constants';
import { circle, fillRoundRect, noShadow, roundRectPath, S, softShadow, sparkle, type Ctx, type PatternFn } from './canvas';
import { darken, lighten, mix, rgba } from './color';
import { drawMark } from './marks';

const bricks: PatternFn = ({ ctx, color, accent, params }) => {
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, S, S);
  const soft = params.bool('soft', false);
  const rows = 4;
  const h = S / rows;
  const w = S / 2;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? 0 : -w / 2;
    for (let x = off; x < S; x += w) {
      const tone = (r + Math.round(x)) % 3 === 0 && !soft ? lighten(color, 0.08) : color;
      fillRoundRect(ctx, x + 3, r * h + 3, w - 6, h - 6, 8, tone);
      fillRoundRect(ctx, x + 7, r * h + 6, w - 20, 4, 2, rgba('#ffffff', soft ? 0.35 : 0.22));
    }
  }
};

const planks: PatternFn = ({ ctx, color, accent }) => {
  const rows = 4;
  const h = S / rows;
  for (let r = 0; r < rows; r++) {
    fillRoundRect(ctx, 2, r * h + 2, S - 4, h - 4, 8, r % 2 === 0 ? color : lighten(color, 0.07));
    circle(ctx, 14, r * h + h / 2, 3, accent);
    circle(ctx, S - 14, r * h + h / 2, 3, accent);
  }
};

function skyGlass(ctx: Ctx, x: number, y: number, w: number, h: number, glass: string): void {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, lighten(glass, 0.35));
  g.addColorStop(1, glass);
  fillRoundRect(ctx, x, y, w, h, 10, g);
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.75);
  ctx.lineTo(x + w * 0.6, y + h * 0.15);
  ctx.stroke();
  ctx.restore();
}

const windowPattern: PatternFn = ({ ctx, color, accent }) => {
  fillRoundRect(ctx, 14, 14, S - 28, S - 28, 16, darken(color, 0.1));
  skyGlass(ctx, 22, 22, S - 44, S - 44, accent);
  fillRoundRect(ctx, S / 2 - 4, 22, 8, S - 44, 4, color);
  fillRoundRect(ctx, 22, S / 2 - 4, S - 44, 8, 4, color);
};

const door: PatternFn = ({ ctx, color, accent }) => {
  const frame = lighten(color, 0.55);
  ctx.beginPath();
  ctx.moveTo(22, S);
  ctx.lineTo(22, 50);
  ctx.arc(S / 2, 50, S / 2 - 22, Math.PI, 0);
  ctx.lineTo(S - 22, S);
  ctx.closePath();
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, S);
  ctx.lineTo(30, 52);
  ctx.arc(S / 2, 52, S / 2 - 30, Math.PI, 0);
  ctx.lineTo(S - 30, S);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  fillRoundRect(ctx, 40, 66, 48, 18, 6, darken(color, 0.12));
  fillRoundRect(ctx, 40, 92, 48, 18, 6, darken(color, 0.12));
  circle(ctx, S / 2, 44, 10, rgba('#ffffff', 0.7));
  softShadow(ctx, 0.2, 3, 1);
  circle(ctx, 84, 88, 6, accent);
  noShadow(ctx);
};

const roof: PatternFn = ({ ctx, color, accent }) => {
  const r = 16;
  for (let row = 0, y = 0; y < S + r; row++, y += r * 1.2) {
    for (let x = row % 2 === 0 ? 0 : r; x < S + r; x += r * 2) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = row % 2 === 0 ? color : mix(color, accent, 0.4);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
};

const glass: PatternFn = ({ ctx, color, accent }) => {
  skyGlass(ctx, 12, 12, S - 24, S - 24, color);
  sparkle(ctx, 92, 34, 9, accent);
};

const lamp: PatternFn = ({ ctx, color, accent }) => {
  const g = ctx.createRadialGradient(S / 2, S / 2, 6, S / 2, S / 2, S * 0.62);
  g.addColorStop(0, accent);
  g.addColorStop(0.45, color);
  g.addColorStop(1, darken(color, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  circle(ctx, S / 2, S / 2 - 6, 24, rgba('#ffffff', 0.85));
  fillRoundRect(ctx, S / 2 - 12, S / 2 + 18, 24, 14, 5, rgba(darken(color, 0.3), 0.6));
  sparkle(ctx, S / 2 - 8, S / 2 - 14, 6, accent);
};

const starShape: PatternFn = ({ ctx, color, accent }) => {
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.6);
  g.addColorStop(0, lighten(color, 0.35));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  drawMark(ctx, 'star', S / 2, S / 2 + 2, 40, accent);
  sparkle(ctx, 24, 26, 6, '#ffffff');
  sparkle(ctx, 104, 100, 5, '#ffffff');
};

export const BUILDING_PATTERNS: Partial<Record<PatternName, PatternFn>> = {
  bricks,
  planks,
  window: windowPattern,
  door,
  roof,
  glass,
  lamp,
  'star-shape': starShape,
};
