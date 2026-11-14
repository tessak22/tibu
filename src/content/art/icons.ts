/** Tray, pack and theme picker icons, drawn on canvas. Browser only. */
import type { ThemeJson } from '../raw-types';
import { circle, context, ellipse, fillRoundRect, makeCanvas, S, sparkle, type Ctx } from './canvas';
import { darken, lighten, rgba } from './color';

/** Applies an affine map so the unit face square (0..S) lands on a parallelogram. */
function drawFace(ctx: Ctx, face: HTMLCanvasElement, origin: [number, number], u: [number, number], v: [number, number], shade: number): void {
  ctx.save();
  ctx.setTransform(u[0] / S, u[1] / S, v[0] / S, v[1] / S, origin[0], origin[1]);
  ctx.drawImage(face, 0, 0, S, S);
  if (shade > 0) {
    ctx.fillStyle = `rgba(40, 20, 60, ${shade})`;
    ctx.fillRect(0, 0, S, S);
  }
  ctx.restore();
}

/** A soft 3/4 view of a block: top plus two sides, with a little shadow. */
export function cubeIcon(top: HTMLCanvasElement, left: HTMLCanvasElement, right: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  const w = 50;
  const h = 54;
  const cx = 64;
  const ty = 14;
  ellipse(ctx, cx, ty + w + h + 6, w * 0.95, 9, 'rgba(40, 20, 60, 0.16)');
  drawFace(ctx, top, [cx, ty], [w, w / 2], [-w, w / 2], 0);
  drawFace(ctx, left, [cx - w, ty + w / 2], [w, w / 2], [0, h], 0.1);
  drawFace(ctx, right, [cx, ty + w], [w, -w / 2], [0, h], 0.2);
  return canvas;
}

/** Pack picker tile: rounded colored card with the pack's showcase block. */
export function packIcon(block: HTMLCanvasElement, tileColor: string): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  fillRoundRect(ctx, 2, 2, S - 4, S - 4, 26, darken(tileColor, 0.08));
  fillRoundRect(ctx, 2, 2, S - 4, S - 8, 26, tileColor);
  ctx.drawImage(block, 14, 12, S - 28, S - 28);
  return canvas;
}

function islandPath(ctx: Ctx, shape: ThemeJson['island']['shape']): void {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.moveTo(24, 82);
    ctx.lineTo(64, 66);
    ctx.lineTo(104, 82);
    ctx.lineTo(64, 98);
    ctx.closePath();
  } else if (shape === 'blob') {
    ctx.ellipse(60, 82, 42, 14, -0.08, 0, Math.PI * 2);
  } else {
    ctx.ellipse(64, 82, 42, 15, 0, 0, Math.PI * 2);
  }
}

/** Theme picker picture: sky, floating island in its ground color, a sun or stars. */
export function themeIcon(theme: ThemeJson, groundTop: string, groundSide: string, sceneColors: readonly string[]): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, theme.sky.top);
  sky.addColorStop(1, theme.sky.bottom);
  fillRoundRect(ctx, 2, 2, S - 4, S - 4, 26, sky);
  if (theme.sky.stars) {
    for (const [x, y, r] of [[20, 22, 5], [44, 14, 3.5], [100, 36, 4], [76, 22, 3], [26, 52, 3]] as const) sparkle(ctx, x, y, r, '#fff6b0');
    circle(ctx, 98, 20, 10, '#fff1a8');
  } else {
    circle(ctx, 98, 26, 13, rgba('#fff3a0', 0.5));
    circle(ctx, 98, 26, 10, '#ffe066');
    const cloud = theme.cloudColor ?? '#ffffff';
    for (const [x, r] of [[26, 8], [36, 10], [46, 8]] as const) circle(ctx, x, 30, r, cloud);
  }
  // Island underside.
  ctx.beginPath();
  ctx.moveTo(24, 82);
  ctx.quadraticCurveTo(64, 132, 104, 82);
  ctx.closePath();
  ctx.fillStyle = groundSide;
  ctx.fill();
  islandPath(ctx, theme.island.shape);
  ctx.fillStyle = groundTop;
  ctx.fill();
  // A few tiny scene blocks so each theme looks different at a glance.
  sceneColors.slice(0, 3).forEach((color, i) => {
    const x = 46 + i * 14;
    const y = 66 - (i === 1 ? 8 : 0);
    fillRoundRect(ctx, x, y, 12, 12, 3, color);
    fillRoundRect(ctx, x, y, 12, 4, 2, lighten(color, 0.3));
  });
  return canvas;
}
