/** Basic patterns: dots, stripes, checker, noise, glyph, dots-count, note, spots, fluffy. */
import type { PatternName } from '../constants';
import { circle, drawText, ellipse, fillRoundRect, noShadow, S, softShadow, type Ctx, type PatternFn } from './canvas';
import { darken, lighten, luma, rgba } from './color';
import { between } from './random';

const dots: PatternFn = ({ ctx, accent, params }) => {
  const gap = params.num('spacing', 32);
  const r = params.num('radius', 7);
  for (let row = 0, y = gap / 2; y < S + r; row++, y += gap) {
    for (let x = row % 2 === 0 ? gap / 2 : 0; x < S + r; x += gap) circle(ctx, x, y, r, accent);
  }
};

const stripes: PatternFn = ({ ctx, accent, params }) => {
  const count = Math.max(1, params.num('count', 5));
  const angle = (params.num('angle', 45) * Math.PI) / 180;
  const band = (S * 1.6) / (count * 2);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(angle);
  for (let i = -count; i <= count; i++) fillRoundRect(ctx, i * band * 2 - band / 2, -S, band, S * 2, band / 2, accent);
  ctx.restore();
};

const checker: PatternFn = ({ ctx, accent, params }) => {
  const n = Math.max(2, params.num('count', 4));
  const cell = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((x + y) % 2 === 0) fillRoundRect(ctx, x * cell + 2, y * cell + 2, cell - 4, cell - 4, cell * 0.25, accent);
    }
  }
};

const noise: PatternFn = ({ ctx, color, accent, rng, params }) => {
  const n = params.num('amount', 70);
  for (let i = 0; i < n; i++) {
    const tone = rng() < 0.5 ? accent : lighten(color, 0.25);
    circle(ctx, rng() * S, rng() * S, between(rng, 1.5, 4), rgba(tone, 0.55));
  }
};

/** Text color that reads well on the face color. */
function inkFor(color: string): { fill: string; outline: string } {
  return luma(color) > 0.75
    ? { fill: darken(color, 0.55), outline: lighten(color, 0.4) }
    : { fill: '#ffffff', outline: darken(color, 0.3) };
}

const glyph: PatternFn = ({ ctx, color, params }) => {
  const text = params.str('text', '?');
  const ink = inkFor(color);
  const px = text.length > 1 ? 70 : 92;
  drawText(ctx, text, S / 2, S / 2 + 4, px, params.str('textColor', ink.fill), ink.outline);
};

/** Dot positions for 0..10 in unit space; dice faces up to 6, then ten-frame style rows. */
const LAYOUTS: readonly (readonly [number, number][])[] = [
  [],
  [[0.5, 0.5]],
  [[0.3, 0.3], [0.7, 0.7]],
  [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
  [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.5, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
  [[0.25, 0.3], [0.42, 0.3], [0.58, 0.3], [0.75, 0.3], [0.25, 0.7], [0.42, 0.7], [0.58, 0.7], [0.75, 0.7]],
  [[0.27, 0.27], [0.5, 0.27], [0.73, 0.27], [0.27, 0.5], [0.5, 0.5], [0.73, 0.5], [0.27, 0.73], [0.5, 0.73], [0.73, 0.73]],
  [[0.2, 0.36], [0.35, 0.36], [0.5, 0.36], [0.65, 0.36], [0.8, 0.36], [0.2, 0.64], [0.35, 0.64], [0.5, 0.64], [0.65, 0.64], [0.8, 0.64]],
];

function numberBadge(ctx: Ctx, n: number, color: string): void {
  softShadow(ctx, 0.15, 3, 1);
  circle(ctx, 26, 26, 15, '#ffffff');
  noShadow(ctx);
  drawText(ctx, String(n), 26, 27, 20, darken(color, 0.25), '#ffffff');
}

const dotsCount: PatternFn = ({ ctx, color, params }) => {
  const n = Math.max(0, Math.min(10, Math.round(params.num('count', 0))));
  const dotColor = luma(color) > 0.75 ? darken(color, 0.5) : '#ffffff';
  const r = n >= 8 ? 8 : n >= 5 ? 10 : 12;
  if (n === 0) {
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(dotColor, 0.8);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // With the numeral badge in the top-left corner, shrink the layout toward the lower right.
  const badge = params.bool('showNumeral', true) && n > 0;
  const place = (u: number, v: number): [number, number] =>
    badge ? [(0.53 + (u - 0.5) * 0.85) * S, (0.58 + (v - 0.5) * 0.78) * S] : [u * S, v * S];
  softShadow(ctx, 0.2, 3, 2);
  for (const [u, v] of LAYOUTS[n]) {
    const [x, y] = place(u, v);
    circle(ctx, x, y, badge ? r * 0.9 : r, dotColor);
  }
  noShadow(ctx);
  if (badge) numberBadge(ctx, n, color);
};

/** A friendly eighth note with the note letter in a badge. */
const note: PatternFn = ({ ctx, color, params }) => {
  const ink = '#ffffff';
  softShadow(ctx, 0.22, 4, 2);
  ellipse(ctx, 52, 82, 17, 13, ink, -0.35);
  fillRoundRect(ctx, 63, 30, 8, 54, 4, ink);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(67, 30);
  ctx.bezierCurveTo(84, 36, 94, 46, 88, 62);
  ctx.bezierCurveTo(86, 50, 78, 46, 67, 45);
  ctx.closePath();
  ctx.fill();
  noShadow(ctx);
  fillRoundRect(ctx, 80, 80, 34, 34, 12, '#ffffff');
  drawText(ctx, params.str('label', '?'), 97, 98, 24, darken(color, 0.2), '#ffffff');
  if (params.bool('high', false)) {
    circle(ctx, 97, 72, 4, '#ffffff');
  }
};

/** Soft round patches, like a cow or a puppy. */
const spots: PatternFn = ({ ctx, accent, rng, params }) => {
  const n = params.num('count', 4);
  for (let i = 0; i < n; i++) {
    const x = between(rng, 14, S - 14);
    const y = between(rng, 14, S - 14);
    const r = between(rng, 10, 18);
    for (let j = 0; j < 4; j++) circle(ctx, x + between(rng, -r, r) * 0.6, y + between(rng, -r, r) * 0.6, r * between(rng, 0.6, 0.9), accent);
  }
};

/** Puffy wool or feathers made of overlapping soft circles. */
const fluffy: PatternFn = ({ ctx, color, rng }) => {
  for (let y = 10; y < S; y += 20) {
    for (let x = (y / 20) % 2 === 0 ? 8 : 18; x < S; x += 22) {
      const r = between(rng, 11, 15);
      circle(ctx, x + between(rng, -3, 3), y + 2, r, darken(color, 0.06));
      circle(ctx, x + between(rng, -3, 3), y, r * 0.85, lighten(color, 0.35));
    }
  }
};

export const BASIC_PATTERNS: Partial<Record<PatternName, PatternFn>> = {
  dots,
  stripes,
  checker,
  noise,
  glyph,
  'dots-count': dotsCount,
  note,
  spots,
  fluffy,
};
