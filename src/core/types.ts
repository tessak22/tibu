import type { Object3D } from 'three';

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

/** Size of a world in cells. Each saved world records its own size. */
export interface WorldSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Little-builder world (the original Tibu island). Also the default for v1 saves. */
export const WORLD_SIZE: WorldSize = { x: 24, y: 16, z: 24 };
/** Big-kid explore world: several islands joined by bridges. */
export const BIG_WORLD_SIZE: WorldSize = { x: 96, y: 32, z: 96 };

/**
 * Play mode, chosen per child profile in the parent area.
 * - little: the original toddler experience (small island, build cards).
 * - big: big world to walk around, step-by-step builds, parts, harder challenges.
 */
export type PlayMode = 'little' | 'big';

/** Quarter turns about the y axis (0 = default facing). Used by shaped parts. */
export type Rotation = 0 | 1 | 2 | 3;

/** Geometry of a block. 'cube' is the default; the rest are "parts" (big-kid mode). */
export type BlockShape = 'cube' | 'slope' | 'slab' | 'plate' | 'wheel' | 'cone' | 'arch' | 'pane' | 'cylinder';

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

/** 'walk' exists only in big-kid mode: taps move the character. */
export type Mode = 'build' | 'smash' | 'walk';

// ---------------------------------------------------------------------------
// World model (implemented in src/world)
// ---------------------------------------------------------------------------

/** A single reversible change. Undo applies the inverse. */
export type WorldAction =
  | { readonly type: 'place'; readonly cell: Cell; readonly block: BlockKey; readonly rot?: Rotation }
  | { readonly type: 'remove'; readonly cell: Cell; readonly block: BlockKey; readonly rot?: Rotation }
  /**
   * Several changes applied (and undone) as one step, e.g. a smash that topples a tower.
   * Listeners receive the batch, never its parts separately.
   */
  | { readonly type: 'batch'; readonly reason: 'collapse'; readonly actions: readonly WorldAction[] };

/** World entity that is not a block (big-kid mode). */
export interface WorldEntity {
  readonly id: string;
  readonly kind: 'chest';
  readonly cell: Cell;
  /** Sticker id inside the chest. */
  readonly sticker: string;
  readonly opened: boolean;
}

/** Serialized world. This is what storage persists and what export writes. */
export interface SavedWorld {
  readonly format: 'tibu-world';
  /** 1 = original 24x16x24 island. 2 adds size, kind, rotations and entities. Loaders accept both. */
  readonly version: 1 | 2;
  readonly themeId: string;
  /** v2 only. Missing means WORLD_SIZE. */
  readonly size?: WorldSize;
  /** v2 only. Missing means 'island'. */
  readonly kind?: 'island' | 'explore';
  /** v2 only: seed used to generate an explore world. */
  readonly seed?: number;
  /** Distinct block keys used in this world. */
  readonly palette: readonly BlockKey[];
  /** Sparse list of occupied cells: [x, y, z, paletteIndex] or [x, y, z, paletteIndex, rotation]. */
  readonly blocks: readonly (readonly number[])[];
  /** v2 only: chests etc. */
  readonly entities?: readonly WorldEntity[];
}

export interface WorldModel {
  readonly themeId: string;
  readonly size: WorldSize;
  readonly kind: 'island' | 'explore';
  get(cell: Cell): BlockKey | null;
  /** Rotation of the block at cell (0 when empty or unrotated). */
  getRotation(cell: Cell): Rotation;
  inBounds(cell: Cell): boolean;
  /** Returns the applied action, or null if the cell is out of bounds or occupied. */
  place(cell: Cell, block: BlockKey, rot?: Rotation): WorldAction | null;
  /** Returns the applied action, or null if the cell is empty. */
  remove(cell: Cell): WorldAction | null;
  /**
   * Child smash. With topple, every block no longer connected (through faces) to the
   * ground floor (y = 0) falls too, returned as one 'batch' action so one undo restores all.
   * Without a collapse it returns the plain 'remove' action.
   */
  smash(cell: Cell, options: { readonly topple: boolean }): WorldAction | null;
  /** Entities (chests) in this world; mutated via setEntity so they are saved. */
  entities(): readonly WorldEntity[];
  setEntity(entity: WorldEntity): void;
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
  /** Geometry; 'cube' unless the pack says otherwise. Non-cube blocks honour Rotation. */
  readonly shape: BlockShape;
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

/**
 * Step-by-step build (like toy-brick instructions), big-kid mode. Defined as data in builds/<id>.json.
 * Cells are relative to an anchor the app picks in front of the camera / character.
 */
export interface Blueprint {
  readonly id: string;
  readonly name: string;
  readonly voiceLine: string;
  /** 1 = easy ... 3 = tricky. */
  readonly difficulty: 1 | 2 | 3;
  readonly steps: readonly {
    readonly blocks: readonly {
      readonly x: number;
      readonly y: number;
      readonly z: number;
      readonly block: BlockKey;
      readonly rot?: Rotation;
    }[];
  }[];
}

/** A ghost (translucent preview) block shown by the renderer. */
export interface GhostBlock {
  readonly cell: Cell;
  readonly block: BlockKey;
  readonly rot?: Rotation;
}

export interface BuildCard {
  readonly id: string;
  /** Which mode shows this card. Missing means 'little'. */
  readonly mode?: PlayMode;
  readonly name: string;
  readonly voiceLine: string;
  /** Pattern relative to its own origin. Matching ignores translation and allows 90° turns. */
  readonly blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly block: BlockKey }[];
}

export interface ContentRegistry {
  readonly packs: readonly ResolvedPack[];
  readonly themes: readonly ThemeDef[];
  readonly cards: readonly BuildCard[];
  readonly blueprints: readonly Blueprint[];
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
  /** Smashing a block knocks down everything resting on it (undo restores it all). */
  readonly toppleTowers: boolean;
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
  toppleTowers: true,
};

export interface Profile {
  readonly id: string;
  /** Animal picture id, e.g. "cat". */
  readonly animal: string;
  /** Missing means 'little'. */
  readonly mode?: PlayMode;
  /** Sticker ids found in explore worlds (big-kid mode). Never removed by play. */
  readonly stickers?: readonly string[];
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
  placed: { cell: Cell; block: BlockKey; tappedCell: Cell | null; rot: Rotation };
  /** collapsed = number of extra blocks that toppled with it (0 when none). */
  smashed: { cell: Cell; block: BlockKey; collapsed: number };
  /** A block was tapped (build mode tap on its face, before the new block is placed). */
  tappedBlock: { cell: Cell; block: BlockKey };
  /** A tap that did nothing useful (e.g. sky, out of bounds) — still gets a soft response. */
  tappedEmpty: Record<string, never>;
  /** Walk mode: tap on a walkable top surface. `cell` is the empty cell to stand in. */
  walkTo: { cell: Cell };
}

/** Options for a non-block object added to the scene (character, animals, chests). */
export interface ActorOptions {
  /** Called when the actor is tapped in any mode; the tap then does nothing else. */
  readonly onTap?: () => void;
}

export interface GameView {
  /** Show a world. The view subscribes to model changes and rebuilds only changed chunks. */
  setWorld(world: WorldModel, theme: ThemeDef): void;
  setMode(mode: Mode): void;
  setSelectedBlock(block: BlockKey): void;
  /**
   * Rotation a newly placed part should get: faces away from the camera / follows its yaw,
   * so a slope placed while looking north points north. Used for the tray preview too.
   */
  placementRotation(): Rotation;
  /** Show translucent ghost blocks (step-by-step builds); null clears them. */
  setGhosts(ghosts: readonly GhostBlock[] | null): void;
  /** Add a non-block object (THREE.Object3D) to the world scene. Returns a remover. */
  addActor(object: Object3D, options?: ActorOptions): () => void;
  /** Camera smoothly follows this object (big-kid walk mode); null returns to orbit around it. */
  setFollowTarget(object: Object3D | null): void;
  /** Per-frame callback while the view is active; dt in seconds (clamped). Returns unsubscribe. */
  onFrame(callback: (dt: number) => void): () => void;
  /** World-space center of a cell (for positioning actors). */
  cellCenter(cell: Cell): { x: number; y: number; z: number };
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
