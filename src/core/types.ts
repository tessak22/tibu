/**
 * Shared contracts between Tibu modules.
 *
 * Every module (world, render, input, content, audio, learning, storage, ui)
 * talks to the others only through the types and interfaces in this folder.
 * Change these deliberately: other modules depend on them.
 */

// ---------------------------------------------------------------------------
// World geometry
// ---------------------------------------------------------------------------

/** World bounds. One bounded world per save. */
export const WORLD_SIZE = { x: 24, y: 16, z: 24 } as const;

/** Integer cell coordinate. y is up. 0 <= x < 24, 0 <= y < 16, 0 <= z < 24. */
export interface Cell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Fully qualified block id: `${packId}:${blockId}`, e.g. "colors:red".
 * Theme ground blocks use the same form (e.g. "nature:grass").
 */
export type BlockKey = string;

export type FaceName = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';
export const FACE_NAMES: readonly FaceName[] = ['top', 'bottom', 'north', 'south', 'east', 'west'];

export type Mode = 'build' | 'smash';

// ---------------------------------------------------------------------------
// World model (implemented in src/world)
// ---------------------------------------------------------------------------

/** A single reversible change. Undo applies the inverse. */
export type WorldAction =
  | { readonly type: 'place'; readonly cell: Cell; readonly block: BlockKey }
  | { readonly type: 'remove'; readonly cell: Cell; readonly block: BlockKey };

/** Serialized world. This is what storage persists and what export writes. */
export interface SavedWorld {
  readonly format: 'tibu-world';
  readonly version: 1;
  readonly themeId: string;
  /** Distinct block keys used in this world. */
  readonly palette: readonly BlockKey[];
  /** Sparse list of occupied cells: [x, y, z, paletteIndex]. */
  readonly blocks: readonly (readonly [number, number, number, number])[];
}

export interface WorldModel {
  readonly themeId: string;
  get(cell: Cell): BlockKey | null;
  inBounds(cell: Cell): boolean;
  /** Returns the applied action, or null if the cell is out of bounds or occupied. */
  place(cell: Cell, block: BlockKey): WorldAction | null;
  /** Returns the applied action, or null if the cell is empty. */
  remove(cell: Cell): WorldAction | null;
  /** Steps back one action (max 50 kept). Returns the inverse action applied, or null. */
  undo(): WorldAction | null;
  canUndo(): boolean;
  /** All occupied cells. */
  entries(): Iterable<readonly [Cell, BlockKey]>;
  count(): number;
  serialize(): SavedWorld;
  /** Subscribe to every change (place, remove, undo, load). Returns unsubscribe. */
  onChange(listener: (change: WorldAction, cause: 'action' | 'undo') => void): () => void;
}

// ---------------------------------------------------------------------------
// Content: packs, blocks, themes, cards (implemented in src/content)
// ---------------------------------------------------------------------------

/** How a sound is produced. Synth presets are implemented in src/audio. */
export type SoundRef =
  | { readonly type: 'synth'; readonly preset: string; readonly note?: number }
  | { readonly type: 'file'; readonly url: string };

export type BehaviorName = 'speak' | 'sound' | 'bounce' | 'glow';

/** A block after its pack.json has been loaded and its art generated. */
export interface ResolvedBlock {
  readonly key: BlockKey;
  readonly packId: string;
  readonly id: string;
  /** Spoken name in English (source text). Translations live in voice/LINES.json. */
  readonly name: string;
  /** Voice line id in voice/LINES.json, e.g. "block.colors.red". */
  readonly voiceLine: string;
  /** Square canvases (128x128) for each face. Faces may share a canvas. */
  readonly faces: Readonly<Record<FaceName, HTMLCanvasElement>>;
  /** Tray / picker icon (square canvas). */
  readonly icon: HTMLCanvasElement;
  readonly tapSound?: SoundRef;
  readonly behaviors: readonly BehaviorName[];
  /** Present when the block has the glow behavior. CSS color string. */
  readonly glowColor?: string;
}

export interface ResolvedPack {
  readonly id: string;
  /** English name, spoken when the pack is chosen. */
  readonly name: string;
  readonly voiceLine: string;
  readonly icon: HTMLCanvasElement;
  readonly blocks: readonly ResolvedBlock[];
}

export interface ThemeDef {
  readonly id: string;
  readonly name: string;
  readonly voiceLine: string;
  /** Picture shown in the theme picker. */
  readonly icon: HTMLCanvasElement;
  readonly sky: { readonly top: string; readonly bottom: string; readonly stars?: boolean };
  /** Island shape: which (x,z) columns are solid ground and how deep. */
  readonly island: {
    readonly shape: 'round' | 'square' | 'blob';
    /** Depth of the floating island underside, in blocks, for the visual rock. */
    readonly depth: number;
  };
  /** Ground layers from the top down, e.g. ["nature:grass", "nature:dirt"]. Ground sits at y=0..n-1. */
  readonly ground: readonly BlockKey[];
  /** Pre-built starting scene, cells relative to the world origin. */
  readonly scene: readonly { readonly x: number; readonly y: number; readonly z: number; readonly block: BlockKey }[];
  readonly cloudColor?: string;
}

export interface BuildCard {
  readonly id: string;
  readonly name: string;
  readonly voiceLine: string;
  /** Pattern relative to its own origin. Matching ignores translation and allows 90° turns. */
  readonly blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly block: BlockKey }[];
}

export interface ContentRegistry {
  readonly packs: readonly ResolvedPack[];
  readonly themes: readonly ThemeDef[];
  readonly cards: readonly BuildCard[];
  /** Never throws: unknown keys (e.g. removed pack) resolve to a friendly placeholder block. */
  block(key: BlockKey): ResolvedBlock;
  hasBlock(key: BlockKey): boolean;
  theme(id: string): ThemeDef;
}

// ---------------------------------------------------------------------------
// Settings, profiles and stored worlds (implemented in src/storage)
// ---------------------------------------------------------------------------

export interface Settings {
  readonly sfxOn: boolean;
  readonly sfxVolume: number; // 0..1
  readonly musicOn: boolean; // off by default
  readonly musicVolume: number;
  readonly voiceOn: boolean;
  readonly voiceVolume: number;
  /** Quick mute toggled from the play screen. */
  readonly muted: boolean;
  readonly language: string; // "en"
  /** Pack ids that are enabled. Empty array means all packs. */
  readonly enabledPacks: readonly string[];
  readonly learning: {
    readonly naming: boolean;
    readonly counting: boolean;
    readonly spelling: boolean;
    readonly buildCards: boolean;
  };
  /** Parent-added spelling words (upper-case A-Z only). */
  readonly customWords: readonly string[];
  /** Minutes, or null for no timer. */
  readonly playTimerMinutes: number | null;
  readonly leftHanded: boolean;
  readonly reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sfxOn: true,
  sfxVolume: 0.8,
  musicOn: false,
  musicVolume: 0.4,
  voiceOn: true,
  voiceVolume: 1,
  muted: false,
  language: 'en',
  enabledPacks: [],
  learning: { naming: true, counting: true, spelling: true, buildCards: true },
  customWords: [],
  playTimerMinutes: null,
  leftHanded: false,
  reducedMotion: false,
};

export interface Profile {
  readonly id: string;
  /** Animal picture id, e.g. "cat". */
  readonly animal: string;
  readonly createdAt: number;
}

export interface WorldRecord {
  readonly id: string;
  readonly profileId: string;
  /** Parent-visible name only; children never need it. */
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly data: SavedWorld;
  /** PNG/JPEG snapshot used in the gallery. */
  readonly thumbnail: Blob | null;
}

/** Export file format (one world per file). */
export interface WorldExportFile {
  readonly format: 'tibu-export';
  readonly version: 1;
  readonly exportedAt: string;
  readonly name: string;
  readonly world: SavedWorld;
}

// ---------------------------------------------------------------------------
// Audio and voice (implemented in src/audio)
// ---------------------------------------------------------------------------

export type SfxName = 'place' | 'smash' | 'undo' | 'mode' | 'celebrate' | 'tap' | 'ui' | 'whoosh' | 'sleep';

export interface AudioSystem {
  /** Call from the first user gesture. Safe to call repeatedly. */
  unlock(): void;
  sfx(name: SfxName): void;
  play(sound: SoundRef): void;
  /**
   * Speaks a voice line: plays voice/<lang>/<lineId>.<ext> if present, else falls back to
   * speechSynthesis using `fallbackText` (or the line's text from LINES.json).
   * New speech interrupts older speech. Resolves when finished or skipped.
   */
  speak(lineId: string, fallbackText?: string): Promise<void>;
  /** Speak arbitrary text (e.g. a custom word). Uses a clip if lineId resolves, else speechSynthesis. */
  speakText(text: string): Promise<void>;
  applySettings(settings: Settings): void;
  /** Pauses background music (e.g. while resting) without changing the setting. */
  setMusicSuspended(suspended: boolean): void;
}

// ---------------------------------------------------------------------------
// Game view: rendering + touch input on one canvas (implemented in src/render + src/input)
// ---------------------------------------------------------------------------

export interface GameViewEvents {
  /** Tap on a block face or ground in build mode resolved to a placement target. */
  placed: { cell: Cell; block: BlockKey; tappedCell: Cell | null };
  smashed: { cell: Cell; block: BlockKey };
  /** A block was tapped (build mode tap on its face, before the new block is placed). */
  tappedBlock: { cell: Cell; block: BlockKey };
  /** A tap that did nothing useful (e.g. sky, out of bounds) — still gets a soft response. */
  tappedEmpty: Record<string, never>;
}

export interface GameView {
  /** Show a world. The view subscribes to model changes and rebuilds only changed chunks. */
  setWorld(world: WorldModel, theme: ThemeDef): void;
  setMode(mode: Mode): void;
  setSelectedBlock(block: BlockKey): void;
  /** Fly the camera back to the default view (instant when reduced motion is on). */
  resetCamera(): void;
  setReducedMotion(on: boolean): void;
  /** Gently dim the scene (play timer ending) or restore it. */
  setDimmed(on: boolean): void;
  /** Visual effects used by learning features. */
  confetti(at?: Cell): void;
  bounce(cell: Cell): void;
  /** Render the current view (or a fixed gallery angle) to an image. */
  snapshot(options: { width: number; height: number; galleryAngle?: boolean }): Promise<Blob>;
  on<K extends keyof GameViewEvents>(event: K, listener: (payload: GameViewEvents[K]) => void): () => void;
  /** Pause rendering when hidden (gallery/parent screens). */
  setActive(active: boolean): void;
  dispose(): void;
}
