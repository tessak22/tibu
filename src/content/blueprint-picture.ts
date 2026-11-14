/** Isometric picture of a finished blueprint (or of the build up to a step). Browser only. */
import type { Blueprint, ContentRegistry } from '../core/types';
import { drawBlocksPicture, type PictureBlock } from './art/picture';

/**
 * Picture of `bp`. With `upToStep` (0-based), blocks of later steps are left out
 * and earlier steps are faded so the step's new blocks stand out.
 */
export function blueprintPicture(
  bp: Blueprint, size: number, registry: Pick<ContentRegistry, 'block'>, upToStep?: number,
): HTMLCanvasElement {
  const all: (PictureBlock & { step: number })[] = bp.steps.flatMap((s, step) => s.blocks.map((b) => ({ ...b, step })));
  if (upToStep === undefined) return drawBlocksPicture(all, registry, size);
  const shown = all.filter((b) => b.step <= upToStep);
  return drawBlocksPicture(shown, registry, size, { frame: all, faded: (b) => b.step < upToStep });
}
