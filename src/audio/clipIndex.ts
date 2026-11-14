/**
 * Clip discovery helpers (pure). Paths come from Vite's import.meta.glob and
 * look like "/voice/en/block.colors.red.m4a".
 */

export type ClipLoader = () => Promise<string>;

export interface ClipPath {
  readonly lang: string;
  readonly lineId: string;
  readonly ext: string;
}

/** Preferred format first: AAC .m4a plays everywhere including iPad Safari. */
export const CLIP_EXTENSIONS: readonly string[] = ['m4a', 'mp3'];

export function parseClipPath(path: string): ClipPath | null {
  const match = /(?:^|\/)voice\/([^/]+)\/([^/]+)\.([a-z0-9]+)$/i.exec(path);
  if (!match) return null;
  const [, lang, lineId, ext] = match;
  if (!lang || !lineId || !ext) return null;
  const lowerExt = ext.toLowerCase();
  if (!CLIP_EXTENSIONS.includes(lowerExt)) return null;
  return { lang, lineId, ext: lowerExt };
}

/** lang -> lineId -> loader; picks the preferred extension when both exist. */
export type ClipIndex = ReadonlyMap<string, ReadonlyMap<string, ClipLoader>>;

export function buildClipIndex(loaders: Readonly<Record<string, ClipLoader>>): ClipIndex {
  const best = new Map<string, Map<string, { rank: number; loader: ClipLoader }>>();
  for (const [path, loader] of Object.entries(loaders)) {
    const parsed = parseClipPath(path);
    if (!parsed) continue;
    const rank = CLIP_EXTENSIONS.indexOf(parsed.ext);
    const byLine = best.get(parsed.lang) ?? new Map<string, { rank: number; loader: ClipLoader }>();
    const current = byLine.get(parsed.lineId);
    if (!current || rank < current.rank) byLine.set(parsed.lineId, { rank, loader });
    best.set(parsed.lang, byLine);
  }
  const index = new Map<string, Map<string, ClipLoader>>();
  for (const [lang, byLine] of best) {
    index.set(lang, new Map([...byLine].map(([id, v]) => [id, v.loader] as const)));
  }
  return index;
}

export function findClip(index: ClipIndex, lang: string, lineId: string): ClipLoader | null {
  return index.get(lang)?.get(lineId) ?? null;
}
