/**
 * Explore stickers: ids, names and canvas drawings. The sticker book (UI) uses drawSticker.
 */
import { BADGE_COLORS, PAINTERS } from './stickerArt';

export { STICKERS, STICKER_IDS, GOLD_STAR, GOLD_STAR_STICKER, stickerDef, type StickerDef } from './stickerIds';

const FALLBACK_BADGE = '#fff3bf';

/**
 * Draws a round die-cut style sticker (white rim, pastel badge, picture, gloss) on a new
 * square canvas of `size` pixels. Unknown ids get the gold star so nothing is ever blank.
 */
export function drawSticker(id: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const px = Math.max(16, Math.round(size));
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const painter = PAINTERS[id] ?? PAINTERS['gold-star'];
  ctx.scale(px / 100, px / 100);

  // White rim with a soft drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(60, 40, 80, 0.28)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1.5;
  ctx.beginPath();
  ctx.arc(50, 50, 47, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Pastel badge, then the picture clipped to it.
  ctx.beginPath();
  ctx.arc(50, 50, 42, 0, Math.PI * 2);
  ctx.fillStyle = BADGE_COLORS[id] ?? FALLBACK_BADGE;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(50, 50, 42, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(50, 50);
  ctx.scale(0.84, 0.84);
  ctx.translate(-50, -50);
  painter?.(ctx);
  ctx.restore();

  // Glossy highlight.
  ctx.beginPath();
  ctx.arc(50, 50, 38, Math.PI * 1.08, Math.PI * 1.42);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  return canvas;
}
