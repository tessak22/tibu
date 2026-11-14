// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type WorldRecord } from '../../../src/core/types';
import { createGallery } from '../../../src/ui/gallery';
import { createInstallBanner, INSTALL_DISMISSED_KEY } from '../../../src/ui/install-banner';
import { createProfilePicker } from '../../../src/ui/profile-picker';
import { pickTheme } from '../../../src/ui/theme-picker';
import { fakeCtx } from './helpers';

const record = (id: string, kind?: 'island' | 'explore'): WorldRecord =>
  ({
    id,
    profileId: 'p',
    name: id,
    createdAt: 0,
    updatedAt: 0,
    data: { format: 'tibu-world', version: 1, themeId: 'meadow', palette: [], blocks: [], ...(kind ? { kind } : {}) },
    thumbnail: null,
  }) as WorldRecord;

const tileIds = (el: HTMLElement): string[] =>
  [...el.querySelectorAll<HTMLButtonElement>('.gallery-item')].map((b) => b.getAttribute('aria-label') ?? '');

describe('gallery', () => {
  it('shows a + button and one big thumbnail per world, with no delete', () => {
    const ctx = fakeCtx();
    const onOpen = vi.fn();
    const onNew = vi.fn();
    const g = createGallery(ctx, {
      profile: { id: 'p', animal: 'fox', createdAt: 0 },
      worlds: [record('a'), record('b')],
      mode: 'little',
      onModeChange: vi.fn(),
      onSwitchProfile: null,
      onOpen,
      onNew,
      corner: document.createElement('div'),
      banner: null,
    });
    expect(g.el.querySelectorAll('.gallery-item')).toHaveLength(2);
    expect(g.el.querySelector('.profile-chip')).toBeNull();
    expect(g.el.textContent).not.toMatch(/delete/i);
    g.el.querySelector<HTMLButtonElement>('.gallery-new')!.click();
    g.el.querySelector<HTMLButtonElement>('.gallery-item')!.click();
    expect(onNew).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('a world that cannot be opened only wiggles with a soft sound (no words, nothing opens)', () => {
    const ctx = fakeCtx();
    const onOpen = vi.fn();
    const g = createGallery(ctx, {
      profile: { id: 'p', animal: 'fox', createdAt: 0 },
      worlds: [record('newer')],
      mode: 'little',
      onModeChange: vi.fn(),
      onSwitchProfile: null,
      onOpen,
      canOpen: () => false,
      onNew: vi.fn(),
      corner: document.createElement('div'),
      banner: null,
    });
    const tile = g.el.querySelector<HTMLButtonElement>('.gallery-item')!;
    tile.click();
    expect(onOpen).not.toHaveBeenCalled();
    expect(tile.classList.contains('wiggle')).toBe(true);
    expect(ctx.audio.calls).toEqual(['sfx:tap']);
    expect(tile.textContent).toBe('');
  });

  const gallery = (mode: 'little' | 'big', leftHanded = false) => {
    const ctx = fakeCtx();
    const settings = { ...DEFAULT_SETTINGS, leftHanded };
    const onModeChange = vi.fn();
    const onNew = vi.fn();
    const g = createGallery({ ...ctx, getSettings: () => settings }, {
      profile: { id: 'p', animal: 'fox', createdAt: 0, mode },
      worlds: [record('isle', 'island'), record('old'), record('adv', 'explore')],
      mode,
      onModeChange,
      onSwitchProfile: null,
      onOpen: vi.fn(),
      onNew,
      corner: document.createElement('div'),
      banner: null,
    });
    return { ctx, g, onModeChange, onNew };
  };

  it('lists only the current mode: islands under Little, adventures under Big', () => {
    expect(tileIds(gallery('little').g.el)).toEqual(['isle', 'old']);
    expect(tileIds(gallery('big').g.el)).toEqual(['adv']);
  });

  it('has a Little / Big picture toggle with the active side highlighted', () => {
    const { g } = gallery('big');
    const toggle = g.el.querySelector<HTMLElement>('[data-testid="mode-toggle"]')!;
    expect(toggle).not.toBeNull();
    const little = toggle.querySelector<HTMLButtonElement>('[data-testid="mode-toggle-little"]')!;
    const big = toggle.querySelector<HTMLButtonElement>('[data-testid="mode-toggle-big"]')!;
    for (const b of [little, big]) {
      expect(b.querySelector('canvas')).not.toBeNull();
      expect(b.textContent).toBe('');
    }
    expect(big.getAttribute('aria-pressed')).toBe('true');
    expect(little.getAttribute('aria-pressed')).toBe('false');
    expect(big.closest('.mode-toggle-side')!.classList.contains('active')).toBe(true);
    expect(toggle.textContent).toContain('Little');
    expect(toggle.textContent).toContain('Big adventure');
  });

  it('switching the toggle swaps the listed worlds, tells the app, and removes nothing', () => {
    const { g, ctx, onModeChange } = gallery('little');
    g.el.querySelector<HTMLButtonElement>('[data-testid="mode-toggle-big"]')!.click();
    expect(onModeChange).toHaveBeenCalledWith('big');
    expect(ctx.audio.calls).toContain('sfx:ui');
    expect(tileIds(g.el)).toEqual(['adv']);
    expect(g.el.querySelector('[data-testid="mode-toggle-big"]')!.getAttribute('aria-pressed')).toBe('true');
    g.el.querySelector<HTMLButtonElement>('[data-testid="mode-toggle-little"]')!.click();
    expect(onModeChange).toHaveBeenLastCalledWith('little');
    expect(tileIds(g.el)).toEqual(['isle', 'old']);
    // The "+" stays first and works in either mode.
    expect(g.el.querySelector('.gallery-grid')!.firstElementChild!.classList.contains('gallery-new')).toBe(true);
  });

  it('tapping the side that is already on only pops: no change', () => {
    const { g, onModeChange, ctx } = gallery('little');
    g.el.querySelector<HTMLButtonElement>('[data-testid="mode-toggle-little"]')!.click();
    expect(onModeChange).not.toHaveBeenCalled();
    expect(ctx.audio.calls).toEqual(['sfx:tap']);
  });

  it('mirrors for left-handed players', () => {
    expect(gallery('little', true).g.el.getAttribute('dir')).toBe('rtl');
    expect(gallery('little', false).g.el.getAttribute('dir')).toBe('ltr');
  });
});

describe('profile picker', () => {
  it('opens the picked profile', () => {
    const ctx = fakeCtx();
    const onPick = vi.fn();
    const profiles = [
      { id: '1', animal: 'fox', createdAt: 0 },
      { id: '2', animal: 'cat', createdAt: 1 },
    ];
    const s = createProfilePicker(ctx, { profiles, onPick, corner: document.createElement('div') });
    s.el.querySelectorAll<HTMLButtonElement>('.profile-btn')[1]!.click();
    expect(onPick).toHaveBeenCalledWith(profiles[1]);
  });
});

describe('theme picker', () => {
  it('resolves the chosen theme', async () => {
    const ctx = fakeCtx();
    const p = pickTheme(ctx);
    ctx.overlayRoot.querySelectorAll<HTMLButtonElement>('.picture-btn')[1]!.click();
    expect(await p).toMatchObject({ theme: { id: 'beach' }, kind: 'island' });
  });
  it('offers only islands to little builders', () => {
    const ctx = fakeCtx();
    void pickTheme(ctx, 'little');
    const kinds = [...ctx.overlayRoot.querySelectorAll<HTMLButtonElement>('.picture-btn')].map((b) => b.dataset.kind);
    expect(kinds).toEqual(['island', 'island']);
  });
  it('offers each theme once, as a big adventure, to big builders', async () => {
    const ctx = fakeCtx();
    const p = pickTheme(ctx, 'big');
    const buttons = [...ctx.overlayRoot.querySelectorAll<HTMLButtonElement>('.picture-btn')];
    expect(buttons.map((b) => b.dataset.testid)).toEqual(['theme-meadow-explore', 'theme-beach-explore']);
    for (const b of buttons) {
      expect(b.textContent).toBe('');
      expect(b.querySelector('canvas')).not.toBeNull();
    }
    buttons[1]!.click();
    expect(await p).toMatchObject({ theme: { id: 'beach' }, kind: 'explore' });
  });
  it('resolves null when closed', async () => {
    const ctx = fakeCtx();
    const p = pickTheme(ctx);
    ctx.overlayRoot.querySelector<HTMLButtonElement>('.overlay-close')!.click();
    expect(await p).toBeNull();
  });
});

describe('install banner', () => {
  const ios = { isIosSafari: true, isStandalone: false };
  it('appears only on iOS Safari when not installed', () => {
    const root = document.createElement('div');
    expect(createInstallBanner(root, { isIosSafari: false, isStandalone: false }, localStorage)).toBeNull();
    expect(createInstallBanner(root, { isIosSafari: true, isStandalone: true }, localStorage)).toBeNull();
    expect(createInstallBanner(root, ios, localStorage)).not.toBeNull();
  });
  it('stays dismissed', () => {
    localStorage.removeItem(INSTALL_DISMISSED_KEY);
    const root = document.createElement('div');
    const banner = createInstallBanner(root, ios, localStorage)!;
    banner.querySelector<HTMLButtonElement>('.banner-x')!.click();
    expect(createInstallBanner(root, ios, localStorage)).toBeNull();
  });
});
