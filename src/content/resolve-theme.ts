/** Turns theme.json data into ThemeDef objects. Browser only (icons are canvases). */
import type { ThemeDef } from '../core/types';
import { context, makeCanvas, S } from './art/canvas';
import { darken } from './art/color';
import { themeIcon } from './art/icons';
import { expandCells } from './cells';
import type { ThemeJson } from './raw-types';
import { themeVoiceLine } from './voice-lines';

/** Block key to its main top color, used to paint theme pictures. */
export type SwatchLookup = (key: string) => string | undefined;

const FALLBACK_SWATCH = '#9fd47f';

function sceneColors(json: ThemeJson, swatch: SwatchLookup): string[] {
  const colors = json.scene.map((e) => swatch(e.block)).filter((c): c is string => c !== undefined);
  return [...new Set(colors)];
}

function imageIcon(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  const scale = Math.max(S / img.naturalWidth, S / img.naturalHeight);
  ctx.drawImage(img, (S - img.naturalWidth * scale) / 2, (S - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
  return canvas;
}

export function resolveTheme(json: ThemeJson, swatch: SwatchLookup, image: HTMLImageElement | undefined): ThemeDef {
  const top = swatch(json.ground[0]) ?? FALLBACK_SWATCH;
  const side = darken(swatch(json.ground[json.ground.length - 1]) ?? top, 0.18);
  const icon = image && image.naturalWidth > 0 ? imageIcon(image) : themeIcon(json, top, side, sceneColors(json, swatch));
  return {
    id: json.id,
    name: json.name,
    voiceLine: themeVoiceLine(json.id),
    icon,
    sky: { ...json.sky },
    island: { ...json.island },
    ground: [...json.ground],
    scene: expandCells(json.scene),
    ...(json.cloudColor ? { cloudColor: json.cloudColor } : {}),
  };
}

/** Used only if no theme loads at all, so the app can still open a world. */
export const FALLBACK_THEME_JSON: ThemeJson = {
  id: 'meadow',
  name: 'Meadow',
  sky: { top: '#6ec3ff', bottom: '#dff3ff' },
  island: { shape: 'round', depth: 4 },
  ground: ['nature:grass', 'nature:dirt'],
  scene: [],
};
