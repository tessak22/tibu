import type { UvRect } from './chunkMesher';

/** Tile art is 128 px; each slot adds a gutter of extruded edge pixels to stop bleeding. */
export const TILE = 128;
export const GUTTER = 8;
export const SLOT = TILE + GUTTER * 2;
export const ATLAS_SIZES = [1024, 2048, 4096] as const;

export function slotsPerRow(size: number): number {
  return Math.floor(size / SLOT);
}

export function capacity(size: number): number {
  return slotsPerRow(size) ** 2;
}

/** Smallest atlas size that holds `count` tiles, or null when even the largest is too small. */
export function sizeFor(count: number): number | null {
  for (const size of ATLAS_SIZES) if (capacity(size) >= count) return size;
  return null;
}

/** Top-left pixel of the tile art (inside the gutter). */
export function slotPixel(slot: number, size: number): { x: number; y: number } {
  const perRow = slotsPerRow(size);
  return { x: (slot % perRow) * SLOT + GUTTER, y: Math.floor(slot / perRow) * SLOT + GUTTER };
}

/** UVs for a slot. Canvas textures are flipped, so canvas y=0 is v=1. Half-texel inset. */
export function slotUv(slot: number, size: number): UvRect {
  const { x, y } = slotPixel(slot, size);
  const inset = 0.5;
  return [(x + inset) / size, 1 - (y + TILE - inset) / size, (x + TILE - inset) / size, 1 - (y + inset) / size];
}
