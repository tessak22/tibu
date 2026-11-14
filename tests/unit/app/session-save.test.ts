// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedWorld, WorldModel, WorldRecord } from '../../../src/core/types';
import { createSessionSaver } from '../../../src/app/session-save';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const bigWorld = () => {
  let version = 0;
  const world = {
    kind: 'explore' as const,
    size: { x: 96, y: 32, z: 96 },
    serialize: vi.fn(() => ({ format: 'tibu-world', version: 2, themeId: `v${version}`, palette: [], blocks: [] }) as SavedWorld),
  };
  return { world: world as unknown as WorldModel & { serialize: ReturnType<typeof vi.fn> }, bump: () => version++ };
};

const setup = (opts: { hidden?: boolean; lastCell?: () => { x: number; y: number; z: number } | null } = {}) => {
  const { world, bump } = bigWorld();
  const updateWorld = vi.fn(async () => null);
  let hidden = opts.hidden ?? false;
  // An idle callback that never fires (a hidden or frozen page).
  const idle = vi.fn(() => new Promise<void>(() => undefined));
  const saver = createSessionSaver({
    view: { snapshot: vi.fn(async () => new Blob()) },
    repo: { updateWorld },
    record: { id: 'w1' } as WorldRecord,
    world,
    exploreState: opts.lastCell
      ? () => {
          const lastCell = opts.lastCell?.();
          return { spawn: { x: 1, y: 1, z: 1 }, animalSpots: [], ...(lastCell ? { lastCell } : {}) };
        }
      : undefined,
    onSaveError: vi.fn(),
    onThumbnailError: vi.fn(),
    isHidden: () => hidden,
    idle,
  });
  return { saver, world, bump, updateWorld, idle, setHidden: (h: boolean) => (hidden = h) };
};

const dataSaves = (updateWorld: ReturnType<typeof vi.fn>) =>
  updateWorld.mock.calls.map((c) => (c as unknown[])[1] as { data?: SavedWorld }).filter((p) => p.data);

describe('session saver', () => {
  it('a save parked on the idle wait is released by finish, with the newest state', async () => {
    const t = setup();
    t.saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000); // Debounce fires; the save waits for idle forever.
    expect(t.idle).toHaveBeenCalledTimes(1);
    expect(t.updateWorld).not.toHaveBeenCalled();
    t.bump();
    t.saver.markDirty();
    await t.saver.finish();
    const saves = dataSaves(t.updateWorld);
    expect(saves.length).toBeGreaterThanOrEqual(1);
    expect(saves[saves.length - 1]?.data?.themeId).toBe('v1');
  });

  it('serializes synchronously when finish starts, before any await', () => {
    const t = setup();
    t.saver.markDirty();
    t.bump();
    void t.saver.finish();
    expect(t.world.serialize).toHaveBeenCalledTimes(1);
    expect(t.world.serialize.mock.results[0]?.value.themeId).toBe('v1');
  });

  it('skips the idle wait while the page is hidden', async () => {
    const t = setup({ hidden: true });
    t.saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.idle).not.toHaveBeenCalled();
    expect(dataSaves(t.updateWorld)).toHaveLength(1);
  });

  it('hiding the page saves right away even with an idle wait pending', async () => {
    const t = setup();
    t.saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    t.setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(dataSaves(t.updateWorld)).toHaveLength(1);
    t.saver.dispose();
  });

  it('saves the character cell on leaving even when no block changed', async () => {
    let cell = { x: 4, y: 1, z: 5 };
    const t = setup({ lastCell: () => cell });
    await t.saver.finish();
    expect(t.updateWorld).toHaveBeenCalledWith('w1', { explore: { spawn: { x: 1, y: 1, z: 1 }, animalSpots: [], lastCell: cell } });
    t.updateWorld.mockClear();
    await t.saver.finish();
    expect(t.updateWorld).not.toHaveBeenCalled(); // Unchanged: nothing to write.
    cell = { x: 6, y: 1, z: 5 };
    await t.saver.finish();
    expect(t.updateWorld).toHaveBeenCalledTimes(1);
    t.saver.dispose();
  });
});
