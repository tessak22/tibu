/** Preloads bundled images so face art can be drawn synchronously. Browser only. */
import { IMAGE_EXTENSIONS } from './constants';

const IMAGE_RE = new RegExp(`\\.(${IMAGE_EXTENSIONS.join('|')})$`, 'i');

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Loads every image asset. Failed images are left out (art falls back to a placeholder). */
export async function preloadImages(assets: ReadonlyMap<string, string>): Promise<Map<string, HTMLImageElement>> {
  const entries = [...assets].filter(([path]) => IMAGE_RE.test(path));
  const loaded = await Promise.all(entries.map(async ([path, url]) => [path, await loadImage(url)] as const));
  const out = new Map<string, HTMLImageElement>();
  for (const [path, img] of loaded) if (img) out.set(path, img);
  return out;
}
