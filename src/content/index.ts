/**
 * Content module entry point: loads packs, themes and build cards bundled
 * from packs/, themes/ and cards/, generates their art and returns a registry.
 */
import type { BuildCard, ContentRegistry, ResolvedPack, ThemeDef } from '../core/types';
import { createArtRenderer } from './art/face';
import { resolveCard } from './cards';
import { byOrder, isCardJson, isPackJson, isThemeJson } from './guards';
import { preloadImages } from './images';
import type { BlockJson, PackJson, ThemeJson } from './raw-types';
import { createRegistry } from './registry';
import { blockSwatch, resolvePack, sortPacks, type ResolveEnv } from './resolve-pack';
import { FALLBACK_THEME_JSON, resolveTheme, type SwatchLookup } from './resolve-theme';
import { bundledSources } from './sources';

export type { ContentRegistry } from '../core/types';

function swatchLookup(packs: readonly PackJson[]): SwatchLookup {
  const byKey = new Map<string, BlockJson>();
  for (const p of packs) for (const b of p.blocks) byKey.set(`${p.id}:${b.id}`, b);
  return (key) => {
    const block = byKey.get(key);
    return block ? blockSwatch(block) : undefined;
  };
}

async function buildRegistry(): Promise<ContentRegistry> {
  const sources = bundledSources();
  const images = await preloadImages(sources.assets);
  const env: ResolveEnv = {
    art: createArtRenderer((folder, rel) => images.get(folder + rel)),
    assets: sources.assets,
  };

  const packJson = sortPacks(sources.packs.map((s) => s.data).filter(isPackJson));
  const packs = packJson.map((p) => resolvePack(p, env)).filter((p): p is ResolvedPack => p !== null);

  const swatch = swatchLookup(packJson);
  const themeJson: ThemeJson[] = sources.themes.map((s) => s.data).filter(isThemeJson).sort(byOrder);
  const themes: ThemeDef[] = themeJson.map((t) => resolveTheme(t, swatch, t.icon ? images.get(`themes/${t.id}/${t.icon}`) : undefined));

  const cards: BuildCard[] = sources.cards.map((s) => s.data).filter(isCardJson).sort(byOrder).map(resolveCard);

  let fallback: ThemeDef | null = null;
  const fallbackTheme = (): ThemeDef => (fallback ??= resolveTheme(FALLBACK_THEME_JSON, swatch, undefined));
  return createRegistry(packs, themes, cards, fallbackTheme);
}

let loading: Promise<ContentRegistry> | null = null;

/** Loads all content once; later calls return the same registry. */
export function loadContent(): Promise<ContentRegistry> {
  loading ??= buildRegistry();
  return loading;
}
