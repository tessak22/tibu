// Renders the app icon SVG to the PNG sizes the PWA manifest and iOS need.
// Usage: node scripts/icons/render-icons.mjs   (requires `npx playwright install chromium`)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const svg = readFileSync(join(here, 'icon.svg'), 'utf8');

/** Maskable icons need the art inside the central 80% safe zone. */
const outputs = [
  { file: 'public/icons/icon-192.png', size: 192, pad: 0 },
  { file: 'public/icons/icon-512.png', size: 512, pad: 0 },
  { file: 'public/icons/maskable-512.png', size: 512, pad: 0.12 },
  { file: 'public/apple-touch-icon.png', size: 180, pad: 0 },
];

/** Keeps the sky background full-bleed and shrinks only the art toward the center. */
const withPadding = (pad) => {
  if (pad === 0) return svg;
  const scale = 1 - 2 * pad;
  const offset = 256 * (1 - scale);
  const bgEnd = svg.indexOf('/>', svg.indexOf('<rect width="512"')) + 2;
  return `${svg.slice(0, bgEnd)}<g transform="translate(${offset} ${offset}) scale(${scale})">${svg
    .slice(bgEnd)
    .replace('</svg>', '</g></svg>')}`;
};

const page = (size, pad) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px">${withPadding(pad).replace('<svg ', '<svg width="100%" height="100%" ')}</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  for (const out of outputs) {
    await tab.setViewportSize({ width: out.size, height: out.size });
    await tab.setContent(page(out.size, out.pad));
    const png = await tab.screenshot({ clip: { x: 0, y: 0, width: out.size, height: out.size } });
    mkdirSync(dirname(join(root, out.file)), { recursive: true });
    writeFileSync(join(root, out.file), png);
  }
  writeFileSync(join(root, 'public/favicon.svg'), svg);
} finally {
  await browser.close();
}
