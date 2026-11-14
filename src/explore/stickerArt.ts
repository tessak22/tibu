/**
 * Canvas painters for explore stickers. Each painter draws into a 100 x 100 space,
 * centred at (50, 50), inside a round sticker badge drawn by stickers.ts. Browser only.
 */
type Ctx = CanvasRenderingContext2D;
export type StickerPainter = (ctx: Ctx) => void;

const INK = '#4a3b52';

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function poly(ctx: Ctx, pts: readonly number[], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0] as number, pts[1] as number);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] as number, pts[i + 1] as number);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Two dot eyes with sparkles and a little smile: the friendly face used on many stickers. */
function face(ctx: Ctx, x: number, y: number, s = 1): void {
  circle(ctx, x - 6 * s, y, 2.6 * s, INK);
  circle(ctx, x + 6 * s, y, 2.6 * s, INK);
  circle(ctx, x - 5.2 * s, y - 0.9 * s, 0.9 * s, '#fff');
  circle(ctx, x + 6.8 * s, y - 0.9 * s, 0.9 * s, '#fff');
  ctx.beginPath();
  ctx.arc(x, y + 3 * s, 3.2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = 'round';
  ctx.stroke();
  circle(ctx, x - 10 * s, y + 4 * s, 2.4 * s, 'rgba(255,120,150,0.45)');
  circle(ctx, x + 10 * s, y + 4 * s, 2.4 * s, 'rgba(255,120,150,0.45)');
}

function starPath(ctx: Ctx, x: number, y: number, outer: number, inner: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function heartPath(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 14 * s);
  ctx.bezierCurveTo(x - 24 * s, y - 2 * s, x - 12 * s, y - 20 * s, x, y - 8 * s);
  ctx.bezierCurveTo(x + 12 * s, y - 20 * s, x + 24 * s, y - 2 * s, x, y + 14 * s);
  ctx.closePath();
}

function puff(ctx: Ctx, x: number, y: number, s: number, fill: string): void {
  circle(ctx, x - 12 * s, y + 3 * s, 9 * s, fill);
  circle(ctx, x, y - 4 * s, 12 * s, fill);
  circle(ctx, x + 12 * s, y + 2 * s, 10 * s, fill);
  roundRect(ctx, x - 20 * s, y + 2 * s, 40 * s, 10 * s, 5 * s, fill);
}

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];

const rainbow: StickerPainter = (ctx) => {
  ctx.lineCap = 'butt';
  RAINBOW.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(50, 62, 32 - i * 4.4, Math.PI, 0);
    ctx.strokeStyle = c;
    ctx.lineWidth = 4.6;
    ctx.stroke();
  });
  puff(ctx, 22, 62, 0.55, '#fff');
  puff(ctx, 78, 62, 0.55, '#fff');
};

const rocket: StickerPainter = (ctx) => {
  poly(ctx, [42, 70, 50, 88, 58, 70], '#ffa94d');
  poly(ctx, [45, 70, 50, 81, 55, 70], '#ffd43b');
  poly(ctx, [36, 52, 26, 72, 38, 68], '#ff6b6b');
  poly(ctx, [64, 52, 74, 72, 62, 68], '#ff6b6b');
  ellipse(ctx, 50, 46, 14, 26, '#f1f3f5');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(50, 46, 14, 26, 0, 0, Math.PI * 2);
  ctx.clip();
  roundRect(ctx, 30, 14, 40, 12, 0, '#ff6b6b');
  ctx.restore();
  circle(ctx, 50, 44, 7.5, '#4dabf7');
  circle(ctx, 50, 44, 5.5, '#a5d8ff');
  circle(ctx, 48, 42, 1.8, '#fff');
};

const star: StickerPainter = (ctx) => {
  starPath(ctx, 50, 52, 34, 16);
  ctx.fillStyle = '#ffd43b';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fab005';
  ctx.stroke();
  face(ctx, 50, 54, 0.9);
};

const sun: StickerPainter = (ctx) => {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(a);
    poly(ctx, [-6, -24, 0, -38, 6, -24], i % 2 ? '#ffa94d' : '#ffd43b');
    ctx.restore();
  }
  circle(ctx, 50, 50, 23, '#ffd43b');
  face(ctx, 50, 50, 1.1);
};

const moon: StickerPainter = (ctx) => {
  circle(ctx, 46, 50, 30, '#ffe066');
  circle(ctx, 62, 40, 26, '#364fc7');
  circle(ctx, 30, 40, 3, '#fcc419');
  circle(ctx, 38, 66, 4, '#fcc419');
  circle(ctx, 30, 55, 2.6, INK);
  ctx.beginPath();
  ctx.arc(34, 61, 3, 0.1 * Math.PI, 0.8 * Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  starPath(ctx, 74, 68, 6, 2.6);
  ctx.fillStyle = '#fff';
  ctx.fill();
  starPath(ctx, 80, 30, 4, 1.8);
  ctx.fill();
};

const heart: StickerPainter = (ctx) => {
  heartPath(ctx, 50, 48, 2.3);
  ctx.fillStyle = '#ff6b8b';
  ctx.fill();
  ellipse(ctx, 30, 36, 6, 3.5, 'rgba(255,255,255,0.7)', -0.6);
  face(ctx, 50, 50, 1.2);
};

const dino: StickerPainter = (ctx) => {
  const g = '#69db7c';
  poly(ctx, [24, 60, 8, 72, 30, 70], g);
  ellipse(ctx, 44, 60, 22, 16, g);
  roundRect(ctx, 56, 30, 12, 30, 6, g);
  ellipse(ctx, 68, 32, 15, 11, g);
  roundRect(ctx, 32, 68, 9, 14, 4, '#51cf66');
  roundRect(ctx, 50, 68, 9, 14, 4, '#51cf66');
  for (let i = 0; i < 4; i++) poly(ctx, [28 + i * 8, 47 - i, 32 + i * 8, 38 - i * 2, 36 + i * 8, 46 - i * 1.5], '#ffa94d');
  ellipse(ctx, 44, 64, 12, 7, '#b2f2bb');
  circle(ctx, 72, 29, 2.6, INK);
  circle(ctx, 72.8, 28.2, 0.9, '#fff');
  circle(ctx, 77, 35, 2, 'rgba(255,120,150,0.5)');
};

const whale: StickerPainter = (ctx) => {
  ellipse(ctx, 46, 58, 30, 20, '#4dabf7');
  poly(ctx, [72, 56, 90, 42, 86, 64], '#4dabf7');
  ellipse(ctx, 46, 66, 24, 10, '#d0ebff');
  ctx.strokeStyle = '#74c0fc';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(40, 36);
  ctx.quadraticCurveTo(38, 24, 30, 20);
  ctx.moveTo(40, 36);
  ctx.quadraticCurveTo(42, 24, 50, 20);
  ctx.stroke();
  face(ctx, 34, 56, 0.85);
};

const butterfly: StickerPainter = (ctx) => {
  ellipse(ctx, 34, 38, 16, 18, '#da77f2', -0.4);
  ellipse(ctx, 66, 38, 16, 18, '#da77f2', 0.4);
  ellipse(ctx, 36, 66, 12, 13, '#ffa8e2', 0.4);
  ellipse(ctx, 64, 66, 12, 13, '#ffa8e2', -0.4);
  circle(ctx, 32, 36, 6, '#ffd43b');
  circle(ctx, 68, 36, 6, '#ffd43b');
  circle(ctx, 36, 67, 4, '#fff');
  circle(ctx, 64, 67, 4, '#fff');
  roundRect(ctx, 46, 30, 8, 46, 4, INK);
  circle(ctx, 50, 28, 6, INK);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(48, 24);
  ctx.quadraticCurveTo(42, 14, 38, 14);
  ctx.moveTo(52, 24);
  ctx.quadraticCurveTo(58, 14, 62, 14);
  ctx.stroke();
};

const iceCream: StickerPainter = (ctx) => {
  poly(ctx, [34, 50, 66, 50, 50, 90], '#f5c27a');
  ctx.strokeStyle = '#d9a35b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 56);
  ctx.lineTo(58, 74);
  ctx.moveTo(60, 56);
  ctx.lineTo(42, 74);
  ctx.stroke();
  circle(ctx, 50, 32, 14, '#ffa8c5');
  circle(ctx, 40, 46, 11, '#b2f2bb');
  circle(ctx, 60, 46, 11, '#fff3bf');
  circle(ctx, 50, 17, 5, '#ff6b6b');
  face(ctx, 50, 33, 0.65);
};

const cupcake: StickerPainter = (ctx) => {
  poly(ctx, [30, 54, 70, 54, 64, 84, 36, 84], '#74c0fc');
  ctx.strokeStyle = '#4dabf7';
  ctx.lineWidth = 2;
  for (let x = 38; x <= 62; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 56);
    ctx.lineTo(x + (x < 50 ? 1 : -1), 82);
    ctx.stroke();
  }
  circle(ctx, 36, 50, 9, '#fcc2d7');
  circle(ctx, 64, 50, 9, '#fcc2d7');
  circle(ctx, 50, 44, 14, '#fcc2d7');
  circle(ctx, 50, 26, 6, '#ff6b6b');
  const sprinkles = ['#ffd43b', '#69db7c', '#9775fa', '#4dabf7'];
  for (let i = 0; i < 8; i++) roundRect(ctx, 34 + ((i * 29) % 32), 40 + ((i * 7) % 14), 4, 1.8, 1, sprinkles[i % 4] as string);
  face(ctx, 50, 68, 0.75);
};

const balloon: StickerPainter = (ctx) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(50, 70);
  ctx.bezierCurveTo(44, 78, 56, 84, 48, 92);
  ctx.stroke();
  ellipse(ctx, 50, 42, 22, 27, '#ff6b6b');
  poly(ctx, [46, 72, 54, 72, 50, 67], '#e03131');
  ellipse(ctx, 41, 32, 5, 8, 'rgba(255,255,255,0.6)', 0.4);
  face(ctx, 50, 46, 0.85);
};

const crown: StickerPainter = (ctx) => {
  poly(ctx, [22, 70, 20, 34, 36, 50, 50, 26, 64, 50, 80, 34, 78, 70], '#ffd43b');
  roundRect(ctx, 20, 66, 60, 12, 4, '#fab005');
  circle(ctx, 20, 34, 4, '#ffa94d');
  circle(ctx, 50, 26, 5, '#ff6b8b');
  circle(ctx, 80, 34, 4, '#ffa94d');
  circle(ctx, 35, 72, 3.2, '#4dabf7');
  circle(ctx, 50, 72, 3.2, '#ff6b6b');
  circle(ctx, 65, 72, 3.2, '#69db7c');
  face(ctx, 50, 54, 0.75);
};

const flower: StickerPainter = (ctx) => {
  roundRect(ctx, 47, 54, 6, 34, 3, '#51cf66');
  ellipse(ctx, 62, 74, 10, 5, '#69db7c', -0.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    circle(ctx, 50 + Math.cos(a) * 15, 40 + Math.sin(a) * 15, 11, i % 2 ? '#ff8fab' : '#ffa8c5');
  }
  circle(ctx, 50, 40, 12, '#ffd43b');
  face(ctx, 50, 40, 0.6);
};

const planet: StickerPainter = (ctx) => {
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate(-0.35);
  ellipse(ctx, 0, 0, 38, 10, '#ffd43b');
  ellipse(ctx, 0, 0, 30, 6, '#5c5f9e');
  ctx.restore();
  circle(ctx, 50, 50, 22, '#9775fa');
  ellipse(ctx, 44, 42, 8, 4, '#b197fc', -0.3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 50, 100, 50);
  ctx.clip();
  ctx.translate(50, 50);
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, 38, 10, 0, 0, Math.PI);
  ctx.strokeStyle = '#ffd43b';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  face(ctx, 50, 52, 0.8);
};

const rainbowFish: StickerPainter = (ctx) => {
  poly(ctx, [70, 50, 90, 34, 90, 66], '#9775fa');
  ellipse(ctx, 46, 50, 28, 20, '#4dabf7');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(46, 50, 28, 20, 0, 0, Math.PI * 2);
  ctx.clip();
  RAINBOW.forEach((c, i) => roundRect(ctx, 36 + i * 6, 28, 6, 46, 0, c));
  ctx.restore();
  circle(ctx, 30, 46, 4, '#fff');
  circle(ctx, 30, 46, 2.4, INK);
  circle(ctx, 30.8, 45.2, 0.9, '#fff');
  ctx.beginPath();
  ctx.arc(26, 54, 3, 0.1 * Math.PI, 0.8 * Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  circle(ctx, 18, 30, 3, '#d0ebff');
  circle(ctx, 14, 22, 2, '#d0ebff');
};

const magicHorse: StickerPainter = (ctx) => {
  const body = '#fff';
  roundRect(ctx, 30, 54, 36, 22, 11, body);
  roundRect(ctx, 34, 70, 7, 16, 3, body);
  roundRect(ctx, 56, 70, 7, 16, 3, body);
  roundRect(ctx, 54, 34, 14, 28, 7, body);
  ellipse(ctx, 66, 36, 14, 10, body, 0.2);
  poly(ctx, [62, 26, 66, 8, 70, 26], '#ffd43b');
  ['#ff8fab', '#b197fc', '#74c0fc'].forEach((c, i) => circle(ctx, 54 - i * 5, 30 + i * 7, 6, c));
  ['#ff8fab', '#b197fc', '#74c0fc'].forEach((c, i) => ellipse(ctx, 26 - i * 2, 58 + i * 6, 6, 4, c, 0.6));
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#dee2e6';
  ctx.beginPath();
  ctx.roundRect(30, 54, 36, 22, 11);
  ctx.stroke();
  circle(ctx, 70, 34, 2.4, INK);
  circle(ctx, 70.8, 33.2, 0.8, '#fff');
  circle(ctx, 74, 40, 2, 'rgba(255,120,150,0.5)');
};

const car: StickerPainter = (ctx) => {
  roundRect(ctx, 16, 48, 68, 22, 10, '#ff6b6b');
  roundRect(ctx, 30, 32, 38, 22, 10, '#ff6b6b');
  roundRect(ctx, 35, 36, 13, 12, 4, '#d0ebff');
  roundRect(ctx, 51, 36, 13, 12, 4, '#d0ebff');
  circle(ctx, 32, 72, 9, INK);
  circle(ctx, 68, 72, 9, INK);
  circle(ctx, 32, 72, 4, '#ced4da');
  circle(ctx, 68, 72, 4, '#ced4da');
  circle(ctx, 82, 56, 3.4, '#ffe066');
  face(ctx, 50, 58, 0.6);
};

const train: StickerPainter = (ctx) => {
  roundRect(ctx, 18, 40, 40, 32, 6, '#4dabf7');
  roundRect(ctx, 56, 50, 28, 22, 6, '#69db7c');
  roundRect(ctx, 24, 46, 14, 12, 3, '#d0ebff');
  roundRect(ctx, 28, 26, 10, 16, 3, INK);
  circle(ctx, 33, 20, 5, '#e9ecef');
  circle(ctx, 40, 14, 4, '#f1f3f5');
  roundRect(ctx, 14, 36, 48, 6, 3, '#ff6b6b');
  for (const x of [28, 48, 64, 78]) {
    circle(ctx, x, 76, 6.5, INK);
    circle(ctx, x, 76, 2.6, '#ffd43b');
  }
  face(ctx, 46, 54, 0.55);
};

const robot: StickerPainter = (ctx) => {
  ctx.strokeStyle = '#868e96';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 24);
  ctx.lineTo(50, 14);
  ctx.stroke();
  circle(ctx, 50, 12, 4, '#ff6b6b');
  roundRect(ctx, 28, 24, 44, 32, 12, '#a5d8ff');
  roundRect(ctx, 33, 30, 34, 20, 8, '#e7f5ff');
  roundRect(ctx, 34, 58, 32, 26, 10, '#74c0fc');
  circle(ctx, 50, 68, 5, '#ffd43b');
  circle(ctx, 26, 66, 6, '#a5d8ff');
  circle(ctx, 74, 66, 6, '#a5d8ff');
  face(ctx, 50, 38, 0.8);
};

const ladybug: StickerPainter = (ctx) => {
  circle(ctx, 50, 30, 11, INK);
  circle(ctx, 50, 56, 26, '#ff6b6b');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 32);
  ctx.lineTo(50, 82);
  ctx.stroke();
  for (const [x, y, r] of [
    [38, 48, 5],
    [62, 48, 5],
    [36, 66, 4],
    [64, 66, 4],
    [50, 72, 3],
  ] as const)
    circle(ctx, x, y, r, INK);
  circle(ctx, 46, 28, 2.2, '#fff');
  circle(ctx, 54, 28, 2.2, '#fff');
};

const snail: StickerPainter = (ctx) => {
  roundRect(ctx, 14, 62, 66, 14, 7, '#ffd8a8');
  roundRect(ctx, 66, 40, 14, 30, 7, '#ffd8a8');
  ctx.strokeStyle = '#ffc078';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 42);
  ctx.lineTo(66, 30);
  ctx.moveTo(76, 42);
  ctx.lineTo(80, 30);
  ctx.stroke();
  circle(ctx, 66, 30, 3, INK);
  circle(ctx, 80, 30, 3, INK);
  circle(ctx, 42, 50, 22, '#da77f2');
  ctx.strokeStyle = '#f3d9fa';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.2) {
    const r = 2 + a * 1.1;
    const x = 42 + Math.cos(a) * r;
    const y = 50 + Math.sin(a) * r;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  circle(ctx, 76, 52, 2, 'rgba(255,120,150,0.5)');
};

const cloud: StickerPainter = (ctx) => {
  puff(ctx, 50, 50, 1.4, '#fff');
  face(ctx, 50, 54, 1);
  ['#74c0fc', '#4dabf7', '#74c0fc'].forEach((c, i) => ellipse(ctx, 36 + i * 14, 80 + (i % 2) * 4, 2.6, 4, c));
};

const lightning: StickerPainter = (ctx) => {
  poly(ctx, [58, 10, 26, 54, 46, 54, 38, 90, 74, 42, 54, 42], '#ffd43b');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fab005';
  ctx.stroke();
  face(ctx, 50, 48, 0.6);
};

const goldStar: StickerPainter = (ctx) => {
  starPath(ctx, 50, 52, 38, 17);
  const g = ctx.createLinearGradient(20, 20, 80, 85);
  g.addColorStop(0, '#fff3bf');
  g.addColorStop(0.5, '#ffd43b');
  g.addColorStop(1, '#f59f00');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#e67700';
  ctx.stroke();
  starPath(ctx, 78, 22, 6, 2.4, 4);
  ctx.fillStyle = '#fff';
  ctx.fill();
  starPath(ctx, 22, 76, 4, 1.6, 4);
  ctx.fill();
  face(ctx, 50, 55, 0.9);
};

export const PAINTERS: Readonly<Record<string, StickerPainter>> = {
  rainbow,
  rocket,
  star,
  sun,
  moon,
  heart,
  dino,
  whale,
  butterfly,
  'ice-cream': iceCream,
  cupcake,
  balloon,
  crown,
  flower,
  planet,
  'rainbow-fish': rainbowFish,
  'magic-horse': magicHorse,
  car,
  train,
  robot,
  ladybug,
  snail,
  cloud,
  lightning,
  'gold-star': goldStar,
};

/** Soft pastel background per sticker so the book looks colourful. */
export const BADGE_COLORS: Readonly<Record<string, string>> = {
  rainbow: '#d0ebff',
  rocket: '#dbe4ff',
  star: '#e5dbff',
  sun: '#d3f9d8',
  moon: '#364fc7',
  heart: '#fff0f6',
  dino: '#fff9db',
  whale: '#e3fafc',
  butterfly: '#f8f0fc',
  'ice-cream': '#fff4e6',
  cupcake: '#fff0f6',
  balloon: '#e7f5ff',
  crown: '#f3f0ff',
  flower: '#ebfbee',
  planet: '#1c2a5e',
  'rainbow-fish': '#c5f6fa',
  'magic-horse': '#f3d9fa',
  car: '#fff9db',
  train: '#fff4e6',
  robot: '#f1f3f5',
  ladybug: '#d3f9d8',
  snail: '#ebfbee',
  cloud: '#a5d8ff',
  lightning: '#5f3dc4',
  'gold-star': '#fff3bf',
};
