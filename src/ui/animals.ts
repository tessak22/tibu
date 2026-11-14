import type { ContentRegistry } from '../core/types';
import { canvasCopy } from './dom';

export const ANIMALS_PACK_ID = 'animals';

/** Used when the animals pack is unavailable. */
const FALLBACK_ANIMALS: readonly { id: string; color: string }[] = [
  { id: 'fox', color: '#ff8a50' },
  { id: 'cat', color: '#ffd54f' },
  { id: 'dog', color: '#bcaaa4' },
  { id: 'bunny', color: '#f8bbd0' },
  { id: 'frog', color: '#9ccc65' },
  { id: 'bear', color: '#a1887f' },
];

export interface AnimalChoice {
  readonly id: string;
  picture(size: number): HTMLCanvasElement;
}

function drawFallback(color: string, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  c.className = 'pic';
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const r = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3e2723';
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(r + dx * r, r * 0.85, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = size / 24;
  ctx.beginPath();
  ctx.arc(r, r * 1.15, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  return c;
}

export function animalChoices(registry: ContentRegistry): AnimalChoice[] {
  const pack = registry.packs.find((p) => p.id === ANIMALS_PACK_ID);
  if (pack && pack.blocks.length > 0) {
    return pack.blocks.map((b) => ({ id: b.id, picture: (size: number) => canvasCopy(b.icon, size) }));
  }
  return FALLBACK_ANIMALS.map((a) => ({ id: a.id, picture: (size: number) => drawFallback(a.color, size) }));
}

export function animalPicture(registry: ContentRegistry, animal: string, size: number): HTMLCanvasElement {
  const choices = animalChoices(registry);
  const match = choices.find((c) => c.id === animal) ?? choices[0];
  return match ? match.picture(size) : drawFallback('#ffd54f', size);
}

/** Picks an animal not used yet by existing profiles, for nicer defaults. */
export function nextFreeAnimal(registry: ContentRegistry, used: readonly string[]): string {
  const choices = animalChoices(registry);
  return (choices.find((c) => !used.includes(c.id)) ?? choices[0])?.id ?? 'fox';
}
