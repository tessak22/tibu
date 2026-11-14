// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { WorldRecord } from '../../../src/core/types';
import { createGallery } from '../../../src/ui/gallery';
import { createInstallBanner, INSTALL_DISMISSED_KEY } from '../../../src/ui/install-banner';
import { createProfilePicker } from '../../../src/ui/profile-picker';
import { pickTheme } from '../../../src/ui/theme-picker';
import { fakeCtx } from './helpers';

const record = (id: string): WorldRecord => ({
  id,
  profileId: 'p',
  name: id,
  createdAt: 0,
  updatedAt: 0,
  data: { format: 'tibu-world', version: 1, themeId: 'meadow', palette: [], blocks: [] },
  thumbnail: null,
});

describe('gallery', () => {
  it('shows a + button and one big thumbnail per world, with no delete', () => {
    const ctx = fakeCtx();
    const onOpen = vi.fn();
    const onNew = vi.fn();
    const g = createGallery(ctx, {
      profile: { id: 'p', animal: 'fox', createdAt: 0 },
      worlds: [record('a'), record('b')],
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
  it('offers each theme as an island and as a big adventure to big builders', async () => {
    const ctx = fakeCtx();
    const p = pickTheme(ctx, 'big');
    const buttons = [...ctx.overlayRoot.querySelectorAll<HTMLButtonElement>('.picture-btn')];
    expect(buttons.map((b) => b.dataset.testid)).toEqual([
      'theme-meadow',
      'theme-beach',
      'theme-meadow-explore',
      'theme-beach-explore',
    ]);
    for (const b of buttons) {
      expect(b.textContent).toBe('');
      expect(b.querySelector('canvas')).not.toBeNull();
    }
    buttons[3]!.click();
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
