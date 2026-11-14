/**
 * In-memory record of background problems (failed saves, thumbnails) so the grown-up area can
 * mention them. Children never see text about these.
 */
export type ProblemKind = 'save' | 'thumbnail';

export interface ProblemEntry {
  readonly kind: ProblemKind;
  readonly at: number;
  readonly detail: string;
}

export interface ProblemLog {
  record(kind: ProblemKind, error?: unknown): void;
  /** Most recent entry of this kind, or null. */
  last(kind: ProblemKind): ProblemEntry | null;
}

const MAX_ENTRIES = 20;

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return error === undefined ? '' : String(error);
}

export function createProblemLog(now: () => number = Date.now): ProblemLog {
  let entries: readonly ProblemEntry[] = [];
  return {
    record(kind, error) {
      entries = [...entries, { kind, at: now(), detail: describe(error) }].slice(-MAX_ENTRIES);
    },
    last(kind) {
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry?.kind === kind) return entry;
      }
      return null;
    },
  };
}
