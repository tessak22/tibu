/**
 * TypeScript shapes of the content JSON files (packs/<id>/pack.json,
 * themes/<id>/theme.json, cards/<id>.json). The JSON Schemas in schemas/
 * are the source of truth; these types describe data that passed them.
 */
import type { MarkName, PatternName, SynthPreset } from './constants';
import type { BehaviorName, BlockShape, PlayMode, Rotation } from '../core/types';

export type ParamValue = string | number | boolean;

export interface SolidArt {
  readonly color: string;
  readonly mark?: MarkName;
  readonly markColor?: string;
  /** Fraction of the face the mark spans (0.2 to 0.9). */
  readonly markSize?: number;
}

export interface PatternArt {
  readonly pattern: PatternName;
  readonly color?: string;
  readonly accent?: string;
  readonly params?: Readonly<Record<string, ParamValue>>;
}

export interface ImageArt {
  /** Path relative to the pack (or theme) folder, e.g. "icons/cow.png". */
  readonly image: string;
}

export type ArtSpec = SolidArt | PatternArt | ImageArt;

export interface FaceOverrides {
  readonly top?: ArtSpec;
  readonly side?: ArtSpec;
  readonly bottom?: ArtSpec;
}

export type SoundSpec =
  | { readonly synth: SynthPreset; readonly note?: number }
  | { readonly file: string };

export interface BlockJson {
  readonly id: string;
  readonly name: string;
  readonly art: ArtSpec;
  readonly faces?: FaceOverrides;
  readonly sound?: SoundSpec;
  readonly behaviors?: readonly BehaviorName[];
  readonly glowColor?: string;
  /** Geometry; missing means 'cube'. */
  readonly shape?: BlockShape;
}

export type PackIconSpec = { readonly block: string } | ArtSpec;

export interface PackJson {
  readonly id: string;
  readonly name: string;
  readonly order?: number;
  readonly description?: string;
  readonly icon?: PackIconSpec;
  readonly tileColor?: string;
  /** Only offered in this play mode; missing means every mode. */
  readonly mode?: PlayMode;
  readonly blocks: readonly BlockJson[];
}

export interface CellEntry {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: string;
}

/** Inclusive box of identical blocks, a shorthand for many cells. */
export interface BoxEntry {
  readonly from: readonly [number, number, number];
  readonly to: readonly [number, number, number];
  readonly block: string;
}

export type SceneEntry = CellEntry | BoxEntry;

export interface ThemeJson {
  readonly id: string;
  readonly name: string;
  readonly order?: number;
  readonly icon?: string;
  readonly sky: { readonly top: string; readonly bottom: string; readonly stars?: boolean };
  readonly island: { readonly shape: 'round' | 'square' | 'blob'; readonly depth: number };
  readonly ground: readonly string[];
  readonly cloudColor?: string;
  readonly scene: readonly SceneEntry[];
}

export interface CardJson {
  readonly id: string;
  readonly name: string;
  readonly order?: number;
  /** Missing means 'little'. */
  readonly mode?: PlayMode;
  readonly blocks: readonly SceneEntry[];
}

/** One block of a blueprint step (cells relative to the build anchor). */
export interface BuildBlockJson {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: string;
  readonly rot?: Rotation;
}

/** builds/<id>.json: a step-by-step build for big-kid mode. */
export interface BuildJson {
  readonly id: string;
  readonly name: string;
  readonly order?: number;
  readonly difficulty: 1 | 2 | 3;
  readonly steps: readonly { readonly blocks: readonly BuildBlockJson[] }[];
}
