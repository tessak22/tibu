/**
 * Picture for a "big adventure" world: the theme icon with Pip (the explore buddy) standing
 * on a little rope bridge in a round badge. Drawn in canvas, no text.
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

/** Pip's mint look (src/explore/three/characterMesh.ts, palette "mint"). */
const PIP = {
  body: '#7fdcc4',
  belly: '#e6fff6',
  feet: '#4fb8a0',
  leaf: '#8fd14f',
  eye: '#2b2440',
  cheek: '#ff9eb0',
  outline: '#3f8f7c',
} as const;

function drawBadge(ctx: CanvasRenderingContext2D, size: number): void {
  const u = size / 256;
  const cx = size - 70 * u;
  const cy = size - 70 * u;
  // Round badge so Pip reads on any theme picture.
  ctx.fillStyle = '#fffdf3';
  ctx.strokeStyle = '#ff8f00';
  ctx.lineWidth = 6 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, 62 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawBridge(ctx, cx, cy + 34 * u, u);
  drawPip(ctx, cx, cy + 30 * u, 64 * u);
}

function drawBridge(ctx: CanvasRenderingContext2D, cx: number, y: number, u: number): void {
  const half = 50 * u;
  ctx.fillStyle = '#a1887f';
  for (let i = -4; i <= 4; i++) {
    const x = cx + i * 11 * u;
    const sag = 6 * u * (1 - (i / 4.5) ** 2);
    ctx.fillRect(x - 4.5 * u, y + sag - 3 * u, 9 * u, 7 * u);
  }
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(cx - half, y - 10 * u);
  ctx.quadraticCurveTo(cx, y + 2 * u, cx + half, y - 10 * u);
  ctx.stroke();
}

/**
 * Pip: a round mint bean with a leaf sprout, big shiny eyes and rosy cheeks.
 * `footY` is where his feet touch the ground; `height` is from feet to the top of the sprout.
 */
export function drawPip(ctx: CanvasRenderingContext2D, cx: number, footY: number, height: number): void {
  const s = height / 100;
  const bodyH = 74 * s;
  const bodyW = 60 * s;
  const bodyCy = footY - 6 * s - bodyH / 2;
  const line = Math.max(1, 2.5 * s);

  // Feet
  ctx.fillStyle = PIP.feet;
  for (const dx of [-14, 14]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * s, footY - 4 * s, 11 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Nub arms
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * (bodyW / 2 + 1 * s), bodyCy + 8 * s, 7 * s, 11 * s, side * -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bean body
  ctx.fillStyle = PIP.body;
  ctx.strokeStyle = PIP.outline;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Belly
  ctx.fillStyle = PIP.belly;
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy + 17 * s, 18 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  drawSprout(ctx, cx, bodyCy - bodyH / 2, s);
  drawFace(ctx, cx, bodyCy - 9 * s, s);
}

function drawSprout(ctx: CanvasRenderingContext2D, cx: number, topY: number, s: number): void {
  ctx.strokeStyle = PIP.leaf;
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.beginPath();
  ctx.moveTo(cx, topY + 2 * s);
  ctx.lineTo(cx, topY - 9 * s);
  ctx.stroke();
  ctx.fillStyle = PIP.leaf;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 9 * s, topY - 12 * s, 10 * s, 4.5 * s, side * -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFace(ctx: CanvasRenderingContext2D, cx: number, eyeY: number, s: number): void {
  for (const dx of [-12, 12]) {
    // Big eyes with a shine
    ctx.fillStyle = PIP.eye;
    ctx.beginPath();
    ctx.ellipse(cx + dx * s, eyeY, 7 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + (dx + 2.5) * s, eyeY - 3.5 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    // Rosy cheeks
    ctx.fillStyle = PIP.cheek;
    ctx.beginPath();
    ctx.ellipse(cx + dx * 1.55 * s, eyeY + 11 * s, 5.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Smile
  ctx.strokeStyle = PIP.eye;
  ctx.lineWidth = Math.max(1, 2.5 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, eyeY + 7 * s, 6 * s, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}
