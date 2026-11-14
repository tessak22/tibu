/**
 * Fetches and decodes the app's own bundled audio files (sound files and voice
 * clips), keeping a small LRU of decoded buffers to bound memory on tablets.
 */
export interface BufferCache {
  load(url: string): Promise<AudioBuffer>;
}

const MAX_ENTRIES = 48;

export function createBufferCache(ctx: AudioContext): BufferCache {
  const cache = new Map<string, Promise<AudioBuffer>>();

  const decode = async (url: string): Promise<AudioBuffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Audio fetch failed (${response.status}): ${url}`);
    const data = await response.arrayBuffer();
    // Callback form keeps older Safari happy; promise form is used when present.
    return new Promise<AudioBuffer>((resolve, reject) => {
      const result = ctx.decodeAudioData(data, resolve, reject);
      if (result && typeof result.then === 'function') result.then(resolve, reject);
    });
  };

  return {
    load(url) {
      const hit = cache.get(url);
      if (hit) {
        cache.delete(url);
        cache.set(url, hit);
        return hit;
      }
      const pending = decode(url);
      cache.set(url, pending);
      pending.catch(() => cache.delete(url));
      while (cache.size > MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return pending;
    },
  };
}
