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

  it('throttles thumbnails and refreshes on finish', async () => {
    const { saveThumbnail, saver } = setup();
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(400);
    expect(saveThumbnail).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(saveThumbnail).toHaveBeenCalledTimes(1);
    saver.markDirty();
    await saver.finish();
    expect(saveThumbnail).toHaveBeenCalledTimes(2);
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
