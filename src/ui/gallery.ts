import type { Profile, WorldRecord } from '../core/types';
import { drawAdventurePicture } from './adventure-badge';
import { animalPicture } from './animals';
import type { UiContext } from './context';
import { canvasCopy, h, iconButton, isolatePointer, pulse } from './dom';
import { ICONS } from './icons';
import type { Screen } from './screen';

export interface GalleryOptions {
  readonly profile: Profile;
  readonly worlds: readonly WorldRecord[];
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

/** Home screen: big world thumbnails and a big "+" button. Nothing here deletes. */
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
  grid.append(plus);
  for (const world of opts.worlds) {
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
    grid.append(btn);
  }

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

  const el = h('div', { class: 'screen gallery-screen' }, [top, opts.banner, h('div', { class: 'gallery-scroll' }, [grid]), opts.corner]);
  isolatePointer(el);
  return {
    el,
    dispose() {
      for (const url of urls) URL.revokeObjectURL(url);
      el.remove();
    },
  };
}
