import type { PlayMode, Profile, WorldRecord } from '../core/types';
import { drawAdventurePicture } from './adventure-badge';
import { animalPicture } from './animals';
import type { UiContext } from './context';
import { canvasCopy, h, iconButton, isolatePointer, pulse } from './dom';
import { ICONS } from './icons';
import { createModeToggle } from './mode-toggle';
import type { Screen } from './screen';
import { worldsForMode } from './theme-picker';

export interface GalleryOptions {
  readonly profile: Profile;
  /** Every world of the player; only the current mode's kind is listed. */
  readonly worlds: readonly WorldRecord[];
  /** The player's mode: Little lists islands, Big lists adventures. */
  readonly mode: PlayMode;
  /** The Little / Big toggle was switched (already shown; the app saves it). */
  readonly onModeChange: (mode: PlayMode) => void;
  /** Shown only when there is more than one profile. */
  readonly onSwitchProfile: (() => void) | null;
  readonly onOpen: (world: WorldRecord) => void;
  /** False for a world whose data cannot be opened: its tile only wiggles (it stays safe). */
  readonly canOpen?: (world: WorldRecord) => boolean;
  readonly onNew: () => void;
  readonly corner: HTMLElement;
  readonly banner: HTMLElement | null;
}

function thumbnail(ctx: UiContext, world: WorldRecord, urls: string[]): HTMLElement {
  if (world.thumbnail) {
    try {
      const url = URL.createObjectURL(world.thumbnail);
      urls.push(url);
      return h('img', { src: url, alt: '', draggable: 'false', class: 'pic' });
    } catch {
      // Fall through to the theme picture.
    }
  }
  const icon = ctx.registry.theme(world.data.themeId).icon;
  return world.data.kind === 'explore' ? drawAdventurePicture(icon, 256) : canvasCopy(icon, 256);
}

function worldTile(ctx: UiContext, opts: GalleryOptions, world: WorldRecord, urls: string[]): HTMLButtonElement {
  const btn = h('button', {
    type: 'button',
    class: 'gallery-item',
    'aria-label': world.name,
    'data-testid': 'gallery-item',
    'data-kind': world.data.kind ?? 'island',
  }, [
    thumbnail(ctx, world, urls),
  ]);
  const openable = opts.canOpen?.(world) ?? true;
  if (!openable) btn.classList.add('cannot-open');
  btn.addEventListener('click', () => {
    if (!openable) {
      // Picture-only, soft response: nothing opens, nothing changes.
      pulse(btn, 'wiggle');
      ctx.audio.sfx('tap');
      return;
    }
    pulse(btn);
    ctx.audio.sfx('whoosh');
    opts.onOpen(world);
  });
  return btn;
}

/**
 * Home screen: the Little / Big toggle, big world thumbnails of the current mode and a big
 * "+" button. Nothing here deletes: the other mode's worlds are only hidden.
 */
export function createGallery(ctx: UiContext, opts: GalleryOptions): Screen {
  const urls: string[] = [];
  const grid = h('div', { class: 'gallery-grid' });
  const plus = iconButton({
    icon: ICONS.plus,
    label: 'New world',
    className: 'gallery-new',
    onTap: () => {
      ctx.audio.sfx('ui');
      opts.onNew();
    },
  });
  plus.dataset.testid = 'gallery-new';
  const render = (mode: PlayMode): void => {
    for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    grid.replaceChildren(plus, ...worldsForMode(opts.worlds, mode).map((w) => worldTile(ctx, opts, w, urls)));
    grid.dataset.mode = mode;
  };
  render(opts.mode);

  const top = h('div', { class: 'gallery-top' });
  if (opts.onSwitchProfile) {
    const switcher = opts.onSwitchProfile;
    top.append(
      iconButton({
        icon: animalPicture(ctx.registry, opts.profile.animal, 128),
        label: 'Change player',
        className: 'profile-chip',
        onTap: () => {
          ctx.audio.sfx('ui');
          switcher();
        },
      }),
    );
  }

  const toggle = createModeToggle(ctx, opts.mode, (mode) => {
    render(mode);
    opts.onModeChange(mode);
  });
  top.append(toggle.el);

  const el = h('div', { class: 'screen gallery-screen', dir: ctx.getSettings().leftHanded ? 'rtl' : 'ltr' }, [top, opts.banner, h('div', { class: 'gallery-scroll' }, [grid]), opts.corner]);
  isolatePointer(el);
  return {
    el,
    dispose() {
      for (const url of urls) URL.revokeObjectURL(url);
      el.remove();
    },
  };
}
