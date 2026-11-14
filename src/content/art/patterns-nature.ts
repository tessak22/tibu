/** Nature patterns: soft, rounded, toy-like textures (never pixel art). */
import type { PatternName } from '../constants';
import { circle, ellipse, fillRoundRect, S, sparkle, type Ctx, type PatternFn } from './canvas';
import { darken, lighten, rgba } from './color';
import { between, type Rng } from './random';

/** Rounded little blade tufts, scattered evenly with jitter. */
function tufts(ctx: Ctx, rng: Rng, tone: string, count: number): void {
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = tone;
  for (let i = 0; i < count; i++) {
    const x = ((i % 5) + 0.5) * (S / 5) + between(rng, -9, 9);
    const y = (Math.floor(i / 5) + 0.6) * (S / Math.ceil(count / 5)) + between(rng, -6, 6);
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 7);
    ctx.quadraticCurveTo(x - 3, y, x, y + 3);
    ctx.quadraticCurveTo(x + 1, y - 4, x + 1, y - 10);
    ctx.moveTo(x + 7, y - 6);
    ctx.quadraticCurveTo(x + 4, y, x + 1, y + 3);
    ctx.stroke();
  }
}

const grass: PatternFn = ({ ctx, color, accent, rng }) => {
  for (let i = 0; i < 6; i++) ellipse(ctx, between(rng, 0, S), between(rng, 0, S), between(rng, 18, 30), between(rng, 12, 20), rgba(lighten(color, 0.18), 0.6));
  tufts(ctx, rng, accent, 20);
  for (let i = 0; i < 4; i++) circle(ctx, between(rng, 14, S - 14), between(rng, 14, S - 14), 3.5, i % 2 ? '#fff6a8' : '#ffffff');
};

const dirt: PatternFn = ({ ctx, color, accent, rng }) => {
  for (let i = 0; i < 16; i++) {
    const tone = i % 3 === 0 ? lighten(color, 0.2) : accent;
    ellipse(ctx, between(rng, 6, S - 6), between(rng, 6, S - 6), between(rng, 5, 10), between(rng, 4, 7), tone, between(rng, 0, Math.PI));
  }
};

const sand: PatternFn = ({ ctx, color, accent, rng }) => {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(accent, 0.7);
  for (let y = 24; y < S; y += 30) {
    ctx.beginPath();
    for (let x = 8; x <= S - 8; x += 4) {
      const yy = y + Math.sin((x / S) * Math.PI * 2 + y) * 4;
      if (x === 8) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) circle(ctx, rng() * S, rng() * S, between(rng, 1.2, 2.4), rng() < 0.5 ? accent : lighten(color, 0.4));
};

const waterWaves: PatternFn = ({ ctx, color, accent, rng }) => {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, lighten(color, 0.15));
  g.addColorStop(1, darken(color, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = rgba(accent, 0.85);
  for (let row = 0; row < 4; row++) {
    const y = 22 + row * 28;
    const off = row % 2 === 0 ? 0 : 16;
    for (let x = 10 + off; x < S - 10; x += 34) {
      ctx.beginPath();
      ctx.arc(x + 8, y + 6, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 3; i++) sparkle(ctx, between(rng, 18, S - 18), between(rng, 18, S - 18), 5, '#ffffff');
};

const woodGrain: PatternFn = ({ ctx, accent, rng }) => {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(accent, 0.75);
  for (let x = 16; x < S; x += 20) {
    ctx.beginPath();
    const wob = between(rng, 2, 5);
    for (let y = 0; y <= S; y += 8) {
      const xx = x + Math.sin(y / 18 + x) * wob;
      if (y === 0) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  ellipse(ctx, between(rng, 40, 88), between(rng, 40, 88), 8, 12, accent);
};

const woodRings: PatternFn = ({ ctx, color, accent }) => {
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(accent, 0.8);
  for (let r = 12; r < 60; r += 12) {
    ctx.beginPath();
    ctx.arc(S / 2 + 2, S / 2 - 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  circle(ctx, S / 2 + 2, S / 2 - 2, 5, darken(color, 0.25));
};

function leaf(ctx: Ctx, x: number, y: number, size: number, rot: number, fill: string, vein: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.75, 0, 0, size);
  ctx.quadraticCurveTo(-size * 0.75, 0, 0, -size);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.7);
  ctx.lineTo(0, size * 0.7);
  ctx.strokeStyle = vein;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

const leaves: PatternFn = ({ ctx, color, accent, rng }) => {
  for (let i = 0; i < 22; i++) {
    const fill = i % 2 === 0 ? accent : darken(color, 0.1);
    leaf(ctx, between(rng, 4, S - 4), between(rng, 4, S - 4), between(rng, 11, 16), between(rng, 0, Math.PI * 2), fill, rgba('#ffffff', 0.35));
  }
};

function flowerAt(ctx: Ctx, x: number, y: number, r: number, petal: string): void {
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, petal);
  }
  circle(ctx, x, y, r * 0.7, '#ffd23f');
}

const flowers: PatternFn = ({ ctx, accent, rng }) => {
  tufts(ctx, rng, rgba('#3f9e3a', 0.5), 15);
  const petals = [accent, '#ffffff', '#ffd23f', '#b9a1ff'];
  const spots: [number, number][] = [[30, 32], [90, 28], [62, 66], [28, 98], [98, 96]];
  spots.forEach(([x, y], i) => flowerAt(ctx, x + between(rng, -5, 5), y + between(rng, -5, 5), 7, petals[i % petals.length]));
};

const stone: PatternFn = ({ ctx, color, accent, rng }) => {
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, S, S);
  const rows = 3;
  const h = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 === 0 ? -10 : -30;
    while (x < S) {
      const w = between(rng, 40, 56);
      const tone = rng() < 0.5 ? color : lighten(color, 0.12);
      fillRoundRect(ctx, x + 3, r * h + 3, w - 6, h - 6, 14, tone);
      x += w;
    }
  }
};

const snow: PatternFn = ({ ctx, accent, rng }) => {
  for (let i = 0; i < 7; i++) ellipse(ctx, between(rng, 0, S), between(rng, 0, S), between(rng, 16, 26), between(rng, 8, 12), rgba(accent, 0.7));
  for (let i = 0; i < 6; i++) sparkle(ctx, between(rng, 12, S - 12), between(rng, 12, S - 12), between(rng, 4, 7), '#bfe0ff');
};

const ice: PatternFn = ({ ctx, accent }) => {
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(accent, 0.75);
  for (const [x, w] of [[30, 10], [52, 5], [82, 8]] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x + 30, 108);
    ctx.stroke();
  }
  sparkle(ctx, 96, 30, 8, '#ffffff');
};

const craters: PatternFn = ({ ctx, color, accent, rng }) => {
  const spots: [number, number, number][] = [[36, 38, 15], [90, 52, 11], [56, 92, 13], [102, 102, 7], [20, 86, 6]];
  for (const [x, y, r] of spots) {
    circle(ctx, x, y + 2, r + 2, lighten(color, 0.3));
    circle(ctx, x, y, r, accent);
    circle(ctx, x - r * 0.2, y + r * 0.2, r * 0.6, darken(accent, 0.05));
  }
  for (let i = 0; i < 4; i++) sparkle(ctx, between(rng, 10, S - 10), between(rng, 10, S - 10), 3.5, '#ffffff');
};

const hay: PatternFn = ({ ctx, color, accent, rng }) => {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (let i = 0; i < 46; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = between(rng, 10, 22);
    ctx.strokeStyle = rng() < 0.5 ? accent : lighten(color, 0.3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + between(rng, -3, 3));
    ctx.stroke();
  }
  fillRoundRect(ctx, 0, S / 2 - 6, S, 12, 6, '#c0603f');
};

export const NATURE_PATTERNS: Partial<Record<PatternName, PatternFn>> = {
  grass,
  dirt,
  sand,
  'water-waves': waterWaves,
  'wood-grain': woodGrain,
  'wood-rings': woodRings,
  leaves,
  flowers,
  stone,
  snow,
  ice,
  craters,
  hay,
};
