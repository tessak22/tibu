import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS, type AudioSystem, type BlockKey, type BuildCard, type Cell, type ContentRegistry, type GameView,
  type GameViewEvents, type PlayMode, type ResolvedBlock, type Settings, type WorldModel,
} from '../../../src/core/types';
import { createLearning } from '../../../src/learning';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(settings: Settings = DEFAULT_SETTINGS, mode: PlayMode = 'little') {
  const cells = new Map<string, BlockKey>();
  const key = (c: Cell) => `${c.x},${c.y},${c.z}`;
  const world = {
    get: (c: Cell) => cells.get(key(c)) ?? null,
    inBounds: (c: Cell) => c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < 24 && c.y < (mode === 'big' ? 32 : 16) && c.z < 24,
  } as unknown as WorldModel;
  const handlers = new Map<string, (p: unknown) => void>();
  const view = {
    on: (event: string, l: (p: unknown) => void) => {
      handlers.set(event, l);
      return () => handlers.delete(event);
    },
    confetti: vi.fn(),
    setGhosts: vi.fn(),
    bounce: vi.fn(),
  } as unknown as GameView;
  const emit = <K extends keyof GameViewEvents>(event: K, payload: GameViewEvents[K]) => handlers.get(event)?.(payload);
  const audio = {
    sfx: vi.fn(),
    speak: vi.fn(() => Promise.resolve()),
    speakText: vi.fn(() => Promise.resolve()),
    play: vi.fn(),
  } as unknown as AudioSystem & { speak: ReturnType<typeof vi.fn>; sfx: ReturnType<typeof vi.fn>; speakText: ReturnType<typeof vi.fn> };
  const registry = {
    block: (k: BlockKey): ResolvedBlock => {
      const [packId = '', id = ''] = k.split(':');
      return { key: k, packId, id, name: id, voiceLine: `block.${packId}.${id}`, behaviors: [] } as unknown as ResolvedBlock;
    },
  } as unknown as ContentRegistry;
  const learning = createLearning({ view, getWorld: () => world, audio, registry, getSettings: () => settings, getMode: () => mode });
  const put = (x: number, y: number, z: number, block: BlockKey) => {
    cells.set(key({ x, y, z }), block);
    emit('placed', { cell: { x, y, z }, block, tappedCell: null, rot: 0 });
  };
  return { learning, audio, view, put, emit };
}

describe('createLearning', () => {
  it('names a block after a short pause', async () => {
    const { audio, put } = setup();
    put(1, 1, 1, 'colors:red');
    expect(audio.speak).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(audio.speak).toHaveBeenCalledWith('block.colors.red', 'red');
  });

  it('counts a stack', async () => {
    const { audio, put } = setup();
    put(1, 1, 1, 'colors:red');
    put(1, 2, 1, 'colors:red');
    await vi.advanceTimersByTimeAsync(300);
    expect(audio.speak).toHaveBeenCalledTimes(1);
    expect(audio.speak).toHaveBeenCalledWith('count.2', '2');
  });

  it('spells a word, celebrates, and uses speakText for custom words', async () => {
    const { audio, view, put } = setup({ ...DEFAULT_SETTINGS, customWords: ['MIA'] });
    put(0, 1, 0, 'letters:m');
    put(1, 1, 0, 'letters:i');
    put(2, 1, 0, 'letters:a');
    expect(view.confetti).toHaveBeenCalledTimes(1);
    expect(audio.sfx).toHaveBeenCalledWith('celebrate');
    await vi.advanceTimersByTimeAsync(1000);
    expect(audio.speakText).toHaveBeenCalledWith('mia');
    expect(audio.speak.mock.calls.some(([id]) => String(id).startsWith('celebrate.'))).toBe(true);
  });

  it('notifies card listeners once per active card', async () => {
    const { learning, put, view } = setup();
    const card: BuildCard = {
      id: 't', name: 'tower', voiceLine: 'card.t',
      blocks: [0, 1].map((y) => ({ x: 0, y, z: 0, block: 'colors:red' })),
    };
    const matched = vi.fn();
    learning.onCardMatched(matched);
    learning.setActiveCard(card);
    put(5, 1, 5, 'colors:red');
    put(5, 2, 5, 'colors:red');
    put(5, 3, 5, 'colors:red');
    expect(matched).toHaveBeenCalledTimes(1);
    expect(view.confetti).toHaveBeenCalledTimes(1);
    learning.dispose();
  });

  it('stays quiet when learning is off', async () => {
    const { audio, put } = setup({ ...DEFAULT_SETTINGS, learning: { naming: false, counting: false, spelling: false, buildCards: false } });
    put(1, 1, 1, 'colors:red');
    put(1, 2, 1, 'colors:red');
    await vi.advanceTimersByTimeAsync(1000);
    expect(audio.speak).not.toHaveBeenCalled();
  });

  it('counts past 16 only in big mode', async () => {
    for (const [mode, said] of [['big', 'count.20'], ['little', 'count.16']] as const) {
      const { audio, put } = setup(DEFAULT_SETTINGS, mode);
      for (let y = 0; y < 20; y++) put(2, y, 2, 'colors:blue');
      await vi.advanceTimersByTimeAsync(300);
      expect(audio.speak).toHaveBeenLastCalledWith(said, said.slice(6));
    }
  });

  it('spells long words in big mode only', async () => {
    const spell = async (mode: PlayMode) => {
      const { audio, put } = setup(DEFAULT_SETTINGS, mode);
      [...'TRUCK'].forEach((ch, i) => put(i, 1, 0, `letters:${ch.toLowerCase()}`));
      await vi.advanceTimersByTimeAsync(1000);
      return audio.speak.mock.calls.map(([id]) => String(id));
    };
    expect(await spell('big')).toContain('word.truck');
    expect(await spell('little')).not.toContain('word.truck');
  });

  it('sometimes cheers a big topple, never for small ones, and not twice in a row', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const { audio, emit } = setup();
    emit('smashed', { cell: { x: 0, y: 1, z: 0 }, block: 'colors:red', collapsed: 2 });
    await vi.advanceTimersByTimeAsync(300);
    expect(audio.speak).not.toHaveBeenCalled();
    emit('smashed', { cell: { x: 0, y: 1, z: 0 }, block: 'colors:red', collapsed: 5 });
    await vi.advanceTimersByTimeAsync(300);
    expect(String(audio.speak.mock.calls[0]?.[0])).toMatch(/^crash\.\d$/);
    emit('smashed', { cell: { x: 0, y: 1, z: 0 }, block: 'colors:red', collapsed: 5 });
    await vi.advanceTimersByTimeAsync(300);
    expect(audio.speak).toHaveBeenCalledTimes(1);
    random.mockRestore();
  });
});
