/** The ContentRegistry implementation. Browser only. */
import type { BlockKey, BuildCard, ContentRegistry, ResolvedBlock, ResolvedPack, ThemeDef } from '../core/types';
import { paintPlaceholder } from './art/face';
import { cubeIcon } from './art/icons';
import { PLACEHOLDER_VOICE_LINE } from './voice-lines';

function placeholderFactory(): (key: BlockKey) => ResolvedBlock {
  let face: HTMLCanvasElement | null = null;
  let icon: HTMLCanvasElement | null = null;
  const made = new Map<BlockKey, ResolvedBlock>();
  return (key) => {
    const hit = made.get(key);
    if (hit) return hit;
    face ??= paintPlaceholder();
    icon ??= cubeIcon(face, face, face);
    const [packId = 'unknown', id = key] = key.split(':');
    const block: ResolvedBlock = {
      key,
      packId,
      id,
      name: 'block',
      voiceLine: PLACEHOLDER_VOICE_LINE,
      faces: { top: face, bottom: face, north: face, south: face, east: face, west: face },
      icon,
      behaviors: ['bounce'],
    };
    made.set(key, block);
    return block;
  };
}

export function createRegistry(
  packs: readonly ResolvedPack[],
  themes: readonly ThemeDef[],
  cards: readonly BuildCard[],
  fallbackTheme: () => ThemeDef,
): ContentRegistry {
  const blocks = new Map<BlockKey, ResolvedBlock>();
  for (const pack of packs) for (const b of pack.blocks) blocks.set(b.key, b);
  const themeById = new Map(themes.map((t) => [t.id, t] as const));
  const placeholder = placeholderFactory();
  return {
    packs,
    themes,
    cards,
    block: (key) => blocks.get(key) ?? placeholder(key),
    hasBlock: (key) => blocks.has(key),
    theme: (id) => themeById.get(id) ?? themes[0] ?? fallbackTheme(),
  };
}
