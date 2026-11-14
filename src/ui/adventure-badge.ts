/**
 * Picture for a "big adventure" world in the theme picker: the theme icon with a little
 * character standing on a rope bridge in the corner. Drawn in canvas, no text.
 */
export function drawAdventurePicture(themeIcon: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  c.className = 'pic';
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  if (themeIcon.width > 0 && themeIcon.height > 0) ctx.drawImage(themeIcon, 0, 0, size, size);
  drawBadge(ctx, size);
  return c;
}

function drawBadge(ctx: CanvasRenderingContext2D, size: number): void {
  const u = size / 256;
  const cx = size - 66 * u;
  const cy = size - 66 * u;
  // Round badge so the character reads on any theme picture.
  ctx.fillStyle = '#fffdf3';
  ctx.strokeStyle = '#ff8f00';
  ctx.lineWidth = 6 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, 58 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawBridge(ctx, cx, cy + 24 * u, u);
  drawCharacter(ctx, cx, cy - 6 * u, u);
}

function drawBridge(ctx: CanvasRenderingContext2D, cx: number, y: number, u: number): void {
  const half = 44 * u;
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.moveTo(cx - half, y - 14 * u);
  ctx.quadraticCurveTo(cx, y + 4 * u, cx + half, y - 14 * u);
  ctx.stroke();
  ctx.fillStyle = '#a1887f';
  for (let i = -3; i <= 3; i++) {
    const x = cx + i * 12 * u;
    const sag = 10 * u * (1 - (i / 3.6) ** 2);
    ctx.fillRect(x - 5 * u, y + sag - 4 * u, 10 * u, 8 * u);
  }
}

function drawCharacter(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number): void {
  // Body
  ctx.fillStyle = '#42a5f5';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14 * u, 13 * u, 15 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#ffcc80';
  ctx.beginPath();
  ctx.arc(cx, cy - 10 * u, 15 * u, 0, Math.PI * 2);
  ctx.fill();
  // Eyes and smile
  ctx.fillStyle = '#3e2723';
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.arc(cx + dx * u, cy - 12 * u, 2.4 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(cx, cy - 7 * u, 5 * u, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Little backpack strap / flag for adventure
  ctx.strokeStyle = '#e53935';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(cx + 16 * u, cy + 20 * u);
  ctx.lineTo(cx + 16 * u, cy - 22 * u);
  ctx.stroke();
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.moveTo(cx + 16 * u, cy - 22 * u);
  ctx.lineTo(cx + 30 * u, cy - 16 * u);
  ctx.lineTo(cx + 16 * u, cy - 10 * u);
  ctx.closePath();
  ctx.fill();
}
