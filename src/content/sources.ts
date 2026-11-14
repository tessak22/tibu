/**
 * Bundled content via Vite glob imports. JSON is inlined at build time;
 * images and audio come in as hashed URLs so the service worker precaches them.
 * Dropping a new folder into packs/ or themes/ (or a file into cards/) is enough.
 */
import type { SourceFile } from './validate/types';

const packModules = import.meta.glob('/packs/*/pack.json', { eager: true, import: 'default' });
const themeModules = import.meta.glob('/themes/*/theme.json', { eager: true, import: 'default' });
const cardModules = import.meta.glob('/cards/*.json', { eager: true, import: 'default' });
const assetModules = import.meta.glob(
  [
    '/packs/*/icons/**/*.{png,jpg,jpeg,webp,svg}',
    '/packs/*/audio/**/*.{mp3,ogg,wav,m4a,webm}',
    '/themes/*/*.{png,jpg,jpeg,webp,svg}',
  ],
  { eager: true, query: '?url', import: 'default' },
);

export interface RawSources {
  readonly packs: readonly SourceFile[];
  readonly themes: readonly SourceFile[];
  readonly cards: readonly SourceFile[];
  /** Repo-relative path (e.g. "packs/animals/audio/moo.ogg") to bundled URL. */
  readonly assets: ReadonlyMap<string, string>;
}

const repoPath = (globKey: string): string => globKey.replace(/^\//, '');

/** Folder name for "packs/<id>/pack.json", or base name for "cards/<id>.json". */
function expectedId(path: string, isFolder: boolean): string {
  const parts = path.split('/');
  return isFolder ? parts[parts.length - 2] : parts[parts.length - 1].replace(/\.json$/, '');
}

function toSources(modules: Record<string, unknown>, isFolder: boolean): SourceFile[] {
  return Object.keys(modules)
    .sort()
    .map((key) => ({ file: repoPath(key), expectedId: expectedId(repoPath(key), isFolder), data: modules[key] }));
}

export function bundledSources(): RawSources {
  const assets = new Map<string, string>();
  for (const [key, url] of Object.entries(assetModules)) {
    if (typeof url === 'string') assets.set(repoPath(key), url);
  }
  return {
    packs: toSources(packModules, true),
    themes: toSources(themeModules, true),
    cards: toSources(cardModules, false),
    assets,
  };
}
