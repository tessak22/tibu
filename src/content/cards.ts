/** Build card resolution. Pure (no canvas). */
import type { BuildCard } from '../core/types';
import { expandCells } from './cells';
import type { CardJson } from './raw-types';
import { cardVoiceLine } from './voice-lines';

/** Expands boxes and shifts the pattern so its smallest x, y and z are 0. */
export function resolveCard(json: CardJson): BuildCard {
  const cells = expandCells(json.blocks);
  const min = (axis: 'x' | 'y' | 'z'): number => Math.min(...cells.map((c) => c[axis]));
  const [mx, my, mz] = [min('x'), min('y'), min('z')];
  return {
    id: json.id,
    name: json.name,
    voiceLine: cardVoiceLine(json.id),
    blocks: cells.map((c) => ({ x: c.x - mx, y: c.y - my, z: c.z - mz, block: c.block })),
  };
}
