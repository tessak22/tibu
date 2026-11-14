import type { CardJson, PackJson, ThemeJson } from '../raw-types';

/** One validation problem, tied to the file it came from. */
export interface ValidationIssue {
  readonly file: string;
  readonly message: string;
}

/** A raw JSON document plus where it came from. */
export interface SourceFile<T = unknown> {
  /** Repo-relative path, e.g. "packs/colors/pack.json". */
  readonly file: string;
  /** Folder name (packs, themes) or file base name (cards) the id must match. */
  readonly expectedId: string;
  readonly data: T;
}

export interface ContentBundle {
  readonly packs: readonly SourceFile[];
  readonly themes: readonly SourceFile[];
  readonly cards: readonly SourceFile[];
}

export interface TypedBundle {
  readonly packs: readonly SourceFile<PackJson>[];
  readonly themes: readonly SourceFile<ThemeJson>[];
  readonly cards: readonly SourceFile<CardJson>[];
}

/** Answers whether a repo-relative path exists (disk in Node, glob keys in the browser). */
export type FileExists = (repoPath: string) => boolean;
