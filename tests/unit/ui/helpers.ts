import type { AudioSystem, ContentRegistry, ResolvedBlock, ResolvedPack, ThemeDef } from '../../../src/core/types';
import { DEFAULT_SETTINGS } from '../../../src/core/types';
import type { UiContext } from '../../../src/ui/context';

// jsdom has no 2D canvas; return null quietly instead of logging "not implemented".
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

const canvas = (): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  return c;
};

export const fakeBlock = (packId: string, id: string): ResolvedBlock => {
  const face = canvas();
  return {
    key: `${packId}:${id}`,
    packId,
    id,
    name: id,
    voiceLine: `block.${packId}.${id}`,
    faces: { top: face, bottom: face, north: face, south: face, east: face, west: face },
    icon: canvas(),
    behaviors: [],
  };
};

export const fakePack = (id: string, blocks: string[]): ResolvedPack => ({
  id,
  name: id,
  voiceLine: `pack.${id}`,
  icon: canvas(),
  blocks: blocks.map((b) => fakeBlock(id, b)),
});

export const fakeTheme = (id: string): ThemeDef => ({
  id,
  name: id,
  voiceLine: `theme.${id}`,
  icon: canvas(),
  sky: { top: '#fff', bottom: '#fff' },
  island: { shape: 'round', depth: 3 },
  ground: [],
  scene: [],
});

export function fakeRegistry(packs: ResolvedPack[] = [fakePack('colors', ['red', 'blue'])]): ContentRegistry {
  const themes = [fakeTheme('meadow'), fakeTheme('beach')];
  return {
    packs,
    themes,
    cards: [],
    block: (key) => fakeBlock(key.split(':')[0] ?? 'x', key.split(':')[1] ?? 'y'),
    hasBlock: () => true,
    theme: (id) => themes.find((t) => t.id === id) ?? themes[0]!,
  };
}

export function fakeAudio(): AudioSystem & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    unlock: () => calls.push('unlock'),
    sfx: (n) => void calls.push(`sfx:${n}`),
    play: () => void calls.push('play'),
    speak: async (id) => void calls.push(`speak:${id}`),
    speakText: async () => undefined,
    applySettings: () => undefined,
    setMusicSuspended: (on) => void calls.push(`music-suspended:${on}`),
  };
}

export function fakeCtx(registry = fakeRegistry()): UiContext & { audio: ReturnType<typeof fakeAudio> } {
  const overlayRoot = document.createElement('div');
  document.body.append(overlayRoot);
  return { audio: fakeAudio(), registry, overlayRoot, getSettings: () => DEFAULT_SETTINGS };
}
