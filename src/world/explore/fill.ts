import type { BlockKey, Cell } from '../../core/types';
import type { ExplorePalette } from './palette';
import { BRIDGE, VOID, type Terrain } from './terrain';

/** The writer the generator uses: silent, non-undoable (SeedableWorld.seed). */
export interface Writer {
  seed(cell: Cell, block: BlockKey): boolean;
  get(cell: Cell): BlockKey | null;
}

/** Writes island ground (solid down to the floor) and bridge decks (deck + support). */
export function fillGround(t: Terrain, w: Writer, palette: ExplorePalette): void {
  for (let z = 0; z < t.sz; z++) {
    for (let x = 0; x < t.sx; x++) {
      const i = x + z * t.sx;
      const h = t.height[i];
      if (h === VOID) continue;
      if (t.island[i] === BRIDGE) {
        w.seed({ x, y: h, z }, t.surface[i] ?? palette.bridge);
        if (h - 1 >= 0) w.seed({ x, y: h - 1, z }, palette.bridgeSupport);
        continue;
      }
      w.seed({ x, y: h, z }, t.surface[i] ?? palette.top);
      for (let y = h - 1; y >= 0; y--) w.seed({ x, y, z }, palette.under);
    }
  }
}
