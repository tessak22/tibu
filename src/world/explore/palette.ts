import type { BlockKey, ThemeDef } from '../../core/types';
import type { FloraPalette } from './flora';

/**
 * Theme decoration table for explore worlds. Only block keys that exist in the shipped
 * nature, building, colors and parts packs are used (tests check every key).
 */
export interface ExplorePalette {
  readonly top: BlockKey;
  readonly under: BlockKey;
  readonly bridge: BlockKey;
  readonly bridgeSupport: BlockKey;
  /** Replaces the top block in small patches (flowers, ice...). Empty = none. */
  readonly patches: readonly BlockKey[];
  readonly rock: BlockKey;
  /** Toy trees, bushes and flowers; null = none (space). */
  readonly flora: FloraPalette | null;
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
const P = (id: string): BlockKey => `parts:${id}`;
const C = (id: string): BlockKey => `colors:${id}`;

const FLORA: FloraPalette = {
  trunk: P('pillar-white'),
  leaves: [N('leaves'), N('leaves'), N('leaves'), N('leaves'), N('leaves'), C('green')],
  pine: [C('green'), C('green'), N('leaves')],
  blossom: [N('flowers')],
  topper: P('cone-red'),
  snow: null,
  kinds: ['puff', 'puff', 'lollipop', 'lollipop', 'blossom', 'pine'],
  bush: [N('leaves')],
  blooms: [N('flowers'), P('plate-pink'), P('slab-yellow')],
};

const BASE: Omit<ExplorePalette, 'top' | 'under'> = {
  bridge: B('planks'),
  bridgeSupport: N('wood'),
  patches: [N('flowers')],
  rock: N('stone'),
  flora: FLORA,
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
    flora: { ...FLORA, kinds: ['palm', 'palm', 'palm', 'lollipop'], blooms: [N('flowers'), P('plate-pink')] },
    hut: { wall: B('planks'), window: B('window'), roof: B('blue-roof') },
    garden: [N('flowers'), N('grass')],
  },
  snow: {
    patches: [N('ice')],
    flora: {
      ...FLORA,
      snow: N('snow'),
      kinds: ['pine', 'pine', 'pine', 'puff', 'lollipop'],
      blooms: [P('slab-white'), N('ice')],
    },
    hut: { wall: B('wall'), window: B('window'), roof: N('snow') },
    tower: N('stone'),
    garden: [N('ice'), N('snow')],
    terrain: 'snowy',
  },
  space: {
    bridge: B('glass'),
    bridgeSupport: N('stone'),
    patches: [N('stone')],
    flora: null,
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
