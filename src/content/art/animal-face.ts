/** Friendly cartoon animal faces, one painter per animal. Browser only. */
import type { AnimalName } from '../constants';
import { circle, ellipse, fillRoundRect, noShadow, softShadow, type Ctx, type PatternFn } from './canvas';
import { darken, lighten } from './color';
import { beak, catMouth, cheeks, eyes, nostrils, PINK, pointyEar, smile, whiskers } from './animal-parts';

type Painter = (ctx: Ctx, fur: string) => void;

const cow: Painter = (ctx) => {
  const patch = '#6b5149';
  ellipse(ctx, 16, 44, 14, 8, patch, -0.3);
  ellipse(ctx, 112, 44, 14, 8, patch, 0.3);
  ellipse(ctx, 40, 22, 6, 10, '#f3dc9a', -0.4);
  ellipse(ctx, 88, 22, 6, 10, '#f3dc9a', 0.4);
  circle(ctx, 40, 52, 18, patch);
  eyes(ctx, 54);
  softShadow(ctx, 0.12, 3, 2);
  ellipse(ctx, 64, 92, 32, 22, '#ffc2cf');
  noShadow(ctx);
  nostrils(ctx, 88, 12, '#c9768a');
  smile(ctx, 104, 7, 3.5);
};

const pig: Painter = (ctx, fur) => {
  pointyEar(ctx, 30, 24, 16, darken(fur, 0.12));
  pointyEar(ctx, 98, 24, 16, darken(fur, 0.12));
  eyes(ctx, 52);
  cheeks(ctx, 74, 40);
  softShadow(ctx, 0.15, 3, 2);
  ellipse(ctx, 64, 82, 22, 15, darken(fur, 0.12));
  noShadow(ctx);
  nostrils(ctx, 82, 8, darken(fur, 0.45));
  smile(ctx, 106, 7, 3.5);
};

const sheep: Painter = (ctx, fur) => {
  const face = '#f5d6c2';
  ellipse(ctx, 22, 60, 14, 8, face, 0.4);
  ellipse(ctx, 106, 60, 14, 8, face, -0.4);
  softShadow(ctx, 0.12, 4, 2);
  ellipse(ctx, 64, 72, 34, 38, face);
  noShadow(ctx);
  for (const [x, y] of [[44, 34], [64, 28], [84, 34], [54, 26], [74, 26]] as const) circle(ctx, x, y, 13, lighten(fur, 0.4));
  eyes(ctx, 66, 16, 7.5);
  cheeks(ctx, 84, 24);
  nostrils(ctx, 88, 6, darken(face, 0.35));
  smile(ctx, 100, 6, 3.5);
};

const horse: Painter = (ctx, fur) => {
  const mane = darken(fur, 0.4);
  pointyEar(ctx, 34, 22, 13, fur, darken(fur, 0.15));
  pointyEar(ctx, 94, 22, 13, fur, darken(fur, 0.15));
  for (const x of [48, 60, 72, 84]) circle(ctx, x, 16, 11, mane);
  ctx.beginPath();
  ctx.moveTo(64, 30);
  ctx.lineTo(70, 40);
  ctx.lineTo(64, 50);
  ctx.lineTo(58, 40);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  eyes(ctx, 54, 26);
  softShadow(ctx, 0.12, 3, 2);
  ellipse(ctx, 64, 92, 30, 22, lighten(fur, 0.35));
  noShadow(ctx);
  nostrils(ctx, 90, 12, darken(fur, 0.3));
  smile(ctx, 104, 7, 3.5);
};

const chicken: Painter = (ctx) => {
  for (const [x, y, r] of [[52, 22, 10], [64, 16, 12], [76, 22, 10]] as const) circle(ctx, x, y, r, '#ff6363');
  eyes(ctx, 58, 22);
  cheeks(ctx, 78, 38);
  beak(ctx, 70, 12, 16, '#ffb02e');
  ellipse(ctx, 64, 96, 6, 9, '#ff6363');
};

const duck: Painter = (ctx, fur) => {
  ctx.beginPath();
  ctx.arc(64, 18, 10, Math.PI * 0.9, Math.PI * 2.1);
  ctx.strokeStyle = darken(fur, 0.12);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
  eyes(ctx, 54, 22);
  cheeks(ctx, 74, 40);
  softShadow(ctx, 0.15, 3, 2);
  ellipse(ctx, 64, 84, 28, 13, '#ff9a3c');
  noShadow(ctx);
  ctx.beginPath();
  ctx.moveTo(42, 84);
  ctx.quadraticCurveTo(64, 92, 86, 84);
  ctx.strokeStyle = '#e07a20';
  ctx.lineWidth = 3;
  ctx.stroke();
};

const cat: Painter = (ctx, fur) => {
  pointyEar(ctx, 28, 26, 18, fur, PINK);
  pointyEar(ctx, 100, 26, 18, fur, PINK);
  eyes(ctx, 58, 24);
  cheeks(ctx, 80, 40);
  ctx.beginPath();
  ctx.moveTo(57, 72);
  ctx.quadraticCurveTo(64, 70, 71, 72);
  ctx.quadraticCurveTo(64, 82, 57, 72);
  ctx.fillStyle = '#ff7f9e';
  ctx.fill();
  catMouth(ctx, 82);
  whiskers(ctx, 80);
};

const dog: Painter = (ctx, fur) => {
  const ear = darken(fur, 0.3);
  ellipse(ctx, 18, 54, 14, 26, ear, 0.25);
  ellipse(ctx, 110, 54, 14, 26, ear, -0.25);
  eyes(ctx, 52, 22);
  softShadow(ctx, 0.12, 3, 2);
  ellipse(ctx, 64, 86, 26, 20, lighten(fur, 0.45));
  noShadow(ctx);
  ellipse(ctx, 64, 76, 10, 7, '#3b2a40');
  circle(ctx, 61, 74, 2.5, '#ffffff');
  smile(ctx, 92, 8, 3.5);
  fillRoundRect(ctx, 58, 92, 12, 14, 6, '#ff7f9e');
  cheeks(ctx, 84, 42);
};

const bird: Painter = (ctx, fur) => {
  for (const [x, r] of [[58, 7], [66, 9], [74, 7]] as const) circle(ctx, x, 16, r, darken(fur, 0.15));
  ellipse(ctx, 64, 112, 40, 26, lighten(fur, 0.55));
  eyes(ctx, 56, 22);
  cheeks(ctx, 76, 38);
  beak(ctx, 70, 9, 13, '#ffc531');
};

const frog: Painter = (ctx, fur) => {
  softShadow(ctx, 0.12, 3, 2);
  circle(ctx, 38, 34, 20, lighten(fur, 0.1));
  circle(ctx, 90, 34, 20, lighten(fur, 0.1));
  noShadow(ctx);
  circle(ctx, 38, 34, 13, '#ffffff');
  circle(ctx, 90, 34, 13, '#ffffff');
  eyes(ctx, 36, 52, 8);
  nostrils(ctx, 62, 6, darken(fur, 0.35));
  ctx.beginPath();
  ctx.arc(64, 62, 30, Math.PI * 0.2, Math.PI * 0.8);
  ctx.strokeStyle = '#3b2a40';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  cheeks(ctx, 82, 44);
};

const mouse: Painter = (ctx, fur) => {
  circle(ctx, 26, 30, 22, darken(fur, 0.08));
  circle(ctx, 102, 30, 22, darken(fur, 0.08));
  circle(ctx, 26, 30, 13, PINK);
  circle(ctx, 102, 30, 13, PINK);
  eyes(ctx, 62, 20, 8);
  cheeks(ctx, 82, 36);
  circle(ctx, 64, 80, 7, '#ff7f9e');
  whiskers(ctx, 84);
  smile(ctx, 96, 6, 3);
};

const bunny: Painter = (ctx, fur) => {
  for (const x of [44, 84]) {
    ellipse(ctx, x, 14, 12, 26, darken(fur, 0.05));
    ellipse(ctx, x, 16, 6, 18, PINK);
  }
  eyes(ctx, 60, 22);
  cheeks(ctx, 80, 38);
  ellipse(ctx, 64, 76, 6, 4.5, '#ff7f9e');
  catMouth(ctx, 84);
  fillRoundRect(ctx, 58, 88, 12, 11, 3, '#ffffff');
  ctx.strokeStyle = 'rgba(59, 42, 64, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(58, 88, 12, 11);
  whiskers(ctx, 80);
};

const PAINTERS: Record<AnimalName, Painter> = {
  cow, pig, sheep, horse, chicken, duck, cat, dog, bird, frog, mouse, bunny,
};

export const animalFace: PatternFn = ({ ctx, color, params }) => {
  const animal = params.str('animal', 'cow') as AnimalName;
  const painter = PAINTERS[animal] ?? cow;
  painter(ctx, color);
};
