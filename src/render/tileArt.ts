import { GUTTER, TILE } from './atlasLayout';

/**
 * Draws a face canvas into the atlas with a soft bevel (light top-left, shaded bottom-right
 * rim) so blocks feel rounded and toy-like, then extrudes the edge pixels into the gutter.
 */
export function drawTile(ctx: CanvasRenderingContext2D, source: CanvasImageSource, x: number, y: number): void {
  ctx.drawImage(source, x, y, TILE, TILE);
  drawBevel(ctx, x, y);
  extrudeGutter(ctx, x, y);
}

function edgeGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  return g;
}

function drawBevel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const w = 14;
  const light = 'rgba(255,255,255,0.32)';
  const shade = 'rgba(40,30,60,0.2)';
  ctx.save();
  ctx.fillStyle = edgeGradient(ctx, x, y, x, y + w, light);
  ctx.fillRect(x, y, TILE, w);
  ctx.fillStyle = edgeGradient(ctx, x, y, x + w, y, light);
  ctx.fillRect(x, y, w, TILE);
  ctx.fillStyle = edgeGradient(ctx, x, y + TILE, x, y + TILE - w, shade);
  ctx.fillRect(x, y + TILE - w, TILE, w);
  ctx.fillStyle = edgeGradient(ctx, x + TILE, y, x + TILE - w, y, shade);
  ctx.fillRect(x + TILE - w, y, w, TILE);
  // A thin soft outline makes neighbouring same-color blocks readable.
  ctx.strokeStyle = 'rgba(60,40,80,0.1)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
  ctx.restore();
}

function extrudeGutter(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const c = ctx.canvas;
  const g = GUTTER;
  ctx.drawImage(c, x, y, TILE, 1, x, y - g, TILE, g);
  ctx.drawImage(c, x, y + TILE - 1, TILE, 1, x, y + TILE, TILE, g);
  ctx.drawImage(c, x, y - g, 1, TILE + 2 * g, x - g, y - g, g, TILE + 2 * g);
  ctx.drawImage(c, x + TILE - 1, y - g, 1, TILE + 2 * g, x + TILE, y - g, g, TILE + 2 * g);
}
