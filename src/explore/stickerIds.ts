/** Sticker ids and spoken names (pure data, safe to import in Node). */
export interface StickerDef {
  readonly id: string;
  /** English name, for speech fallback and the sticker book. */
  readonly name: string;
  /** Optional voice line id in voice/LINES.json. */
  readonly nameLine?: string;
}

export const GOLD_STAR = 'gold-star';

const NAMES: readonly (readonly [string, string])[] = [
  ['rainbow', 'rainbow'],
  ['rocket', 'rocket'],
  ['star', 'star'],
  ['sun', 'sun'],
  ['moon', 'moon'],
  ['heart', 'heart'],
  ['dino', 'dinosaur'],
  ['whale', 'whale'],
  ['butterfly', 'butterfly'],
  ['ice-cream', 'ice cream'],
  ['cupcake', 'cupcake'],
  ['balloon', 'balloon'],
  ['crown', 'crown'],
  ['flower', 'flower'],
  ['planet', 'planet'],
  ['rainbow-fish', 'rainbow fish'],
  ['magic-horse', 'magic horse'],
  ['car', 'car'],
  ['train', 'train'],
  ['robot', 'robot'],
  ['ladybug', 'ladybug'],
  ['snail', 'snail'],
  ['cloud', 'cloud'],
  ['lightning', 'lightning'],
];

/** The 24 findable stickers, in sticker-book order. */
export const STICKERS: readonly StickerDef[] = NAMES.map(([id, name]) => ({ id, name, nameLine: `sticker.${id}` }));

/** The repeatable bonus once every sticker is found. */
export const GOLD_STAR_STICKER: StickerDef = { id: GOLD_STAR, name: 'gold star', nameLine: 'sticker.gold-star' };

export const STICKER_IDS: readonly string[] = STICKERS.map((s) => s.id);

export function stickerDef(id: string): StickerDef {
  return STICKERS.find((s) => s.id === id) ?? (id === GOLD_STAR ? GOLD_STAR_STICKER : { id, name: 'sticker' });
}
