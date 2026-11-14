import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaver } from '../../../src/storage/autosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  const save = vi.fn(async () => {});
  const saveThumbnail = vi.fn(async () => {});
  const onError = vi.fn();
  const saver = createAutosaver({ save, saveThumbnail, onError, now: () => Date.now() });
  return { save, saveThumbnail, onError, saver };
};

describe('autosaver', () => {
  it('debounces saves to ~300ms after the last change', async () => {
    const { save, saver } = setup();
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(200);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(200);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately', async () => {
    const { save, saver } = setup();
    saver.markDirty();
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('still saves within ~2s while changes keep coming', async () => {
    const { save, saver } = setup();
    // A tap every 150 ms would push a plain 300 ms debounce back forever.
    for (let t = 0; t < 1950; t += 150) {
      saver.markDirty();
      await vi.advanceTimersByTimeAsync(150);
    }
    expect(save).toHaveBeenCalledTimes(0);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(150);
    expect(save).toHaveBeenCalledTimes(1);
    for (let t = 0; t < 2100; t += 150) {
      saver.markDirty();
      await vi.advanceTimersByTimeAsync(150);
    }
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('never renders thumbnails during play, only on finish', async () => {
    const { save, saveThumbnail, saver } = setup();
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveThumbnail).not.toHaveBeenCalled();
    await saver.finish();
    expect(saveThumbnail).toHaveBeenCalledTimes(1);
    await saver.finish();
    expect(saveThumbnail).toHaveBeenCalledTimes(1);
  });

  it('saves data before the thumbnail and keeps thumbnail failures separate', async () => {
    const order: string[] = [];
    const onError = vi.fn();
    const onThumbnailError = vi.fn();
    const saver = createAutosaver({
      save: async () => void order.push('save'),
      saveThumbnail: async () => {
        order.push('thumb');
        throw new Error('webgl lost');
      },
      onError,
      onThumbnailError,
    });
    saver.markDirty();
    await saver.finish();
    expect(order).toEqual(['save', 'thumb']);
    expect(onError).not.toHaveBeenCalled();
    expect(onThumbnailError).toHaveBeenCalledTimes(1);
  });

  it('reports errors without breaking later saves', async () => {
    const { save, onError, saver } = setup();
    save.mockRejectedValueOnce(new Error('quota'));
    saver.markDirty();
    await saver.flush();
    expect(onError).toHaveBeenCalledTimes(1);
    saver.markDirty();
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
