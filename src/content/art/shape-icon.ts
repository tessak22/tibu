/** Tray icons for shaped parts: the actual silhouette in isometric view. Browser only. */
import type { BlockShape, FaceName } from '../../core/types';
import { context, ellipse, makeCanvas } from './canvas';
import { drawIsoBlock, type Pt } from './iso';

/** Same top and bottom as cubeIcon (y 14 to 118), so cubes and parts line up in the tray. */
const SCALE = 52;
const CX = 64;
const TOP_Y = 14;

const toScreen = (p: Pt): Pt => ({ x: CX + p.x * SCALE, y: TOP_Y + SCALE + p.y * SCALE });

/** Isometric icon of a part (slope, wheel, cone ...) painted with its face art. */
export function shapeIcon(shape: BlockShape, faces: Readonly<Record<FaceName, HTMLCanvasElement>>): HTMLCanvasElement {
  const canvas = makeCanvas();
  const ctx = context(canvas);
  ellipse(ctx, CX, TOP_Y + 2 * SCALE + 6, SCALE * 0.9, 9, 'rgba(40, 20, 60, 0.16)');
  drawIsoBlock(ctx, [0, 0, 0], shape, 0, (f) => faces[f], toScreen, 1.5);
  return canvas;
}
