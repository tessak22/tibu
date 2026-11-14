/** Turns face art specs into cached 128x128 canvases. Browser only. */
import type { PatternName } from '../constants';
import type { ArtSpec, PatternArt, SolidArt } from '../raw-types';
import { animalFace } from './animal-face';
import { clipPanel, context, drawBase, drawGloss, drawText, makeCanvas, roundRectPath, S, INSET, RADIUS, type PatternFn } from './canvas';
import { contrastTone, darken } from './color';
import { drawMark } from './marks';
import { readParams } from './params';
import { BASIC_PATTERNS } from './patterns-basic';
import { BUILDING_PATTERNS } from './patterns-building';
import { NATURE_PATTERNS } from './patterns-nature';
import { hashString, seededRng } from './random';

const PATTERNS: Partial<Record<PatternName, PatternFn>> = {
  ...BASIC_PATTERNS,
  ...NATURE_PATTERNS,
  ...BUILDING_PATTERNS,
  'animal-face': animalFace,
};

/** Ground-like textures tile across big areas, so they get a softer block edge. */
const SOFT_RIM = new Set<PatternName>(['grass', 'dirt', 'sand', 'water-waves', 'stone', 'snow', 'craters', 'leaves', 'flowers', 'ice']);

const DEFAULT_COLOR = '#d9d4e4';
export const PLACEHOLDER_COLOR = '#c9c6d4';

/** Looks up a preloaded image for an image path relative to a content folder. */
export type ImageLookup = (folder: string, relPath: string) => HTMLImageElement | undefined;

/** Main color of a piece of art: used for icons, glow and theme pictures. */
export function artColor(spec: ArtSpec): string {
  if ('color' in spec && spec.color) return spec.color;
  return DEFAULT_COLOR;
}

function paintSolid(spec: SolidArt): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  drawBase(ctx, spec.color);
  if (spec.mark) {
    const r = ((spec.markSize ?? 0.42) * S) / 2;
    drawMark(ctx, spec.mark, S / 2, S / 2, r, spec.markColor ?? contrastTone(spec.color));
  }
  drawGloss(ctx);
  return canvas;
}

function paintPattern(spec: PatternArt, seed: number): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  const color = spec.color ?? DEFAULT_COLOR;
  const painter = PATTERNS[spec.pattern];
  if (!painter) return paintPlaceholder();
  drawBase(ctx, color, SOFT_RIM.has(spec.pattern) ? 0.08 : 0.16);
  clipPanel(ctx);
  painter({ ctx, color, accent: spec.accent ?? darken(color, 0.15), params: readParams(spec.params), rng: seededRng(seed) });
  ctx.restore();
  drawGloss(ctx, SOFT_RIM.has(spec.pattern) ? 0.14 : 0.22);
  return canvas;
}

function paintImage(img: HTMLImageElement | undefined): HTMLCanvasElement {
  if (!img || img.naturalWidth === 0) return paintPlaceholder();
  const canvas = makeCanvas();
  const ctx = context(canvas);
  drawBase(ctx, '#ffffff', 0.1);
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, INSET, INSET, S - INSET * 2, S - INSET * 2, RADIUS);
  ctx.clip();
  const scale = Math.max(S / img.naturalWidth, S / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  ctx.restore();
  drawGloss(ctx, 0.12);
  return canvas;
}

/** Soft gray block with a friendly question mark. */
export function paintPlaceholder(): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  drawBase(ctx, PLACEHOLDER_COLOR);
  drawText(ctx, '?', S / 2, S / 2 + 4, 84, '#ffffff', darken(PLACEHOLDER_COLOR, 0.25));
  drawGloss(ctx);
  return canvas;
}

export interface ArtRenderer {
  /** Canvas for `spec`. Identical specs (in the same folder) share one canvas. */
  render(spec: ArtSpec, folder: string): HTMLCanvasElement;
}

export function createArtRenderer(lookupImage: ImageLookup): ArtRenderer {
  const cache = new Map<string, HTMLCanvasElement>();
  const paint = (spec: ArtSpec, folder: string, key: string): HTMLCanvasElement => {
    if ('image' in spec) return paintImage(lookupImage(folder, spec.image));
    if ('pattern' in spec) return paintPattern(spec, hashString(key));
    return paintSolid(spec);
  };
  return {
    render(spec, folder) {
      const key = 'image' in spec ? `${folder}|${spec.image}` : JSON.stringify(spec);
      const hit = cache.get(key);
      if (hit) return hit;
      let canvas: HTMLCanvasElement;
      try {
        canvas = paint(spec, folder, key);
      } catch {
        canvas = paintPlaceholder();
      }
      cache.set(key, canvas);
      return canvas;
    },
  };
}
