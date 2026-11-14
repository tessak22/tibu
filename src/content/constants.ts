/**
 * Shared vocabularies for content JSON. These lists are mirrored as enums in
 * schemas/pack.schema.json; a unit test keeps the two in sync.
 */

/** Synth presets implemented by src/audio. */
export const SYNTH_PRESETS = [
  'moo', 'baa', 'oink', 'neigh', 'cluck', 'quack', 'meow', 'woof', 'tweet', 'ribbit', 'squeak',
  'note', 'chime', 'pop', 'splash', 'rustle', 'knock', 'ding',
] as const;
export type SynthPreset = (typeof SYNTH_PRESETS)[number];

export const BEHAVIORS = ['speak', 'sound', 'bounce', 'glow'] as const;

/** Small friendly shapes drawn on a face (also used for color-blind marks). */
export const MARKS = [
  'circle', 'square', 'rectangle', 'triangle', 'star', 'heart', 'diamond', 'oval', 'moon',
  'hexagon', 'pentagon', 'cross', 'cloud', 'drop', 'flower', 'ring',
] as const;
export type MarkName = (typeof MARKS)[number];

/** Named procedural patterns. */
export const PATTERNS = [
  // basic
  'dots', 'stripes', 'checker', 'noise', 'glyph', 'dots-count', 'note', 'spots', 'fluffy',
  // nature
  'grass', 'dirt', 'sand', 'water-waves', 'wood-grain', 'wood-rings', 'leaves', 'flowers',
  'stone', 'snow', 'ice', 'craters', 'hay',
  // building
  'bricks', 'planks', 'window', 'door', 'roof', 'glass', 'lamp', 'star-shape',
  // characters
  'animal-face',
] as const;
export type PatternName = (typeof PATTERNS)[number];

export const ANIMALS = [
  'cow', 'pig', 'sheep', 'horse', 'chicken', 'duck', 'cat', 'dog', 'bird', 'frog', 'mouse', 'bunny',
] as const;
export type AnimalName = (typeof ANIMALS)[number];

export const ISLAND_SHAPES = ['round', 'square', 'blob'] as const;

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const;
export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a', 'webm'] as const;

/** Face canvas size in pixels. */
export const FACE_SIZE = 128;

/** Scene cells must sit within this radius (in cells) of the island center. */
export const SCENE_MAX_RADIUS = 10;

/** Safety cap on cells produced by one box entry. */
export const MAX_BOX_CELLS = 400;

/** Block geometries (mirrors BlockShape in src/core/types.ts and the pack schema). */
export const SHAPES = ['cube', 'slope', 'slab', 'plate', 'wheel', 'cone', 'arch', 'pane', 'cylinder'] as const;

/** Play modes a pack or card can be limited to (mirrors PlayMode). */
export const PLAY_MODES = ['little', 'big'] as const;

/** Blueprints (builds/<id>.json) must fit in this many cells along each axis. */
export const BUILD_MAX_SIZE = 8;
/** Blueprints may have at most this many blocks in total. */
export const BUILD_MAX_BLOCKS = 80;
