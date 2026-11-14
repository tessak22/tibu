/** Pure helpers for scene and card cell lists. */
import type { BoxEntry, CellEntry, SceneEntry } from './raw-types';

export function isBox(entry: SceneEntry): entry is BoxEntry {
  return 'from' in entry;
}

/** Number of cells a box covers (inclusive on both ends). */
export function boxVolume(box: BoxEntry): number {
  const span = (i: 0 | 1 | 2): number => Math.abs(box.to[i] - box.from[i]) + 1;
  return span(0) * span(1) * span(2);
}

function expandBox(box: BoxEntry): CellEntry[] {
  const lo = (i: 0 | 1 | 2): number => Math.min(box.from[i], box.to[i]);
  const hi = (i: 0 | 1 | 2): number => Math.max(box.from[i], box.to[i]);
  const out: CellEntry[] = [];
  for (let y = lo(1); y <= hi(1); y++) {
    for (let z = lo(2); z <= hi(2); z++) {
      for (let x = lo(0); x <= hi(0); x++) out.push({ x, y, z, block: box.block });
    }
  }
  return out;
}

/**
 * Expands boxes into single cells. Later entries replace earlier ones at the
 * same cell, so a box can be "painted over" (e.g. a door in a wall).
 */
export function expandCells(entries: readonly SceneEntry[]): CellEntry[] {
  const byCell = new Map<string, CellEntry>();
  for (const entry of entries) {
    const cells = isBox(entry) ? expandBox(entry) : [entry];
    for (const c of cells) {
      const k = `${c.x},${c.y},${c.z}`;
      byCell.delete(k);
      byCell.set(k, { x: c.x, y: c.y, z: c.z, block: c.block });
    }
  }
  return [...byCell.values()];
}

/** Block keys referenced by a list of entries. */
export function referencedKeys(entries: readonly SceneEntry[]): string[] {
  return [...new Set(entries.map((e) => e.block))];
}
