import type { BlockKey, ThemeDef } from '../../core/types';

/**
 * Theme decoration table for explore worlds. Only block keys that exist in the shipped
 * nature and building packs are used (no "parts" pack dependency).
 */
export interface ExplorePalette {
  readonly top: BlockKey;
  readonly under: BlockKey;
  readonly bridge: BlockKey;
  readonly bridgeSupport: BlockKey;
  /** Replaces the top block in small patches (flowers, ice...). Empty = none. */
  readonly patches: readonly BlockKey[];
  readonly rock: BlockKey;
  /** null = no trees (space). */
  readonly tree: { readonly trunk: BlockKey; readonly leaves: BlockKey; readonly cap?: BlockKey; readonly tall: boolean } | null;
  readonly hut: { readonly wall: BlockKey; readonly window: BlockKey; readonly roof: BlockKey };
  readonly tower: BlockKey;
  readonly light: BlockKey;
  readonly garden: readonly BlockKey[];
  /** Terrain style: hills, taller snowy hills, or moon craters. */
  readonly terrain: 'hills' | 'snowy' | 'craters';
  /** Extra props scattered around (hay bales etc.), may be empty. */
  readonly props: readonly BlockKey[];
}

const N = (id: string): BlockKey => `nature:${id}`;
const B = (id: string): BlockKey => `building:${id}`;

const BASE: Omit<ExplorePalette, 'top' | 'under'> = {
  bridge: B('planks'),
  bridgeSupport: N('wood'),
  patches: [N('flowers')],
  rock: N('stone'),
  tree: { trunk: N('wood'), leaves: N('leaves'), tall: false },
  hut: { wall: B('planks'), window: B('window'), roof: B('roof') },
  tower: B('brick'),
  light: B('lamp'),
  garden: [N('flowers'), N('grass')],
  terrain: 'hills',
  props: [],
};

const BY_THEME: Record<string, Partial<ExplorePalette>> = {
  meadow: {},
  farm: { props: [N('hay')], garden: [N('flowers'), N('dirt'), N('hay')] },
  beach: {
    patches: [N('flowers')],
    tree: { trunk: N('wood'), leaves: N('leaves'), tall: true },
    hut: { wall: B('planks'), window: B('window'), roof: B('blue-roof') },
    garden: [N('flowers'), N('grass')],
  },
  snow: {
    patches: [N('ice')],
    tree: { trunk: N('wood'), leaves: N('leaves'), cap: N('snow'), tall: true },
    hut: { wall: B('wall'), window: B('window'), roof: N('snow') },
    tower: N('stone'),
    garden: [N('ice'), N('snow')],
    terrain: 'snowy',
  },
  space: {
    bridge: B('glass'),
    bridgeSupport: N('stone'),
    patches: [N('stone')],
    tree: null,
    hut: { wall: B('wall'), window: B('glass'), roof: B('blue-roof') },
    tower: B('wall'),
    light: B('star-light'),
    garden: [N('moon-rock'), B('star-light')],
    terrain: 'craters',
  },
};

/** Builds the palette for a theme. Unknown themes get meadow-style decor with their own ground. */
export function explorePalette(theme: ThemeDef): ExplorePalette {
  const ground = Array.isArray(theme.ground) ? theme.ground.filter((k) => typeof k === 'string' && k) : [];
  const top = ground[0] ?? N('grass');
  const under = ground[1] ?? top;
  return { ...BASE, ...(BY_THEME[theme.id] ?? {}), top, under };
}
