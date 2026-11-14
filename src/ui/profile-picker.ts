import type { Profile } from '../core/types';
import { animalPicture } from './animals';
import type { UiContext } from './context';
import { h, isolatePointer, pulse } from './dom';
import type { Screen } from './screen';

export interface ProfilePickerOptions {
  readonly profiles: readonly Profile[];
  readonly onPick: (profile: Profile) => void;
  readonly corner: HTMLElement;
}

/** First screen when several children share a device: big animal pictures, no text. */
export function createProfilePicker(ctx: UiContext, opts: ProfilePickerOptions): Screen {
  const grid = h('div', { class: 'profile-grid' });
  for (const profile of opts.profiles) {
    const btn = h('button', { type: 'button', class: 'profile-btn', 'aria-label': `Player ${profile.animal}` }, [
      animalPicture(ctx.registry, profile.animal, 256),
    ]);
    btn.addEventListener('click', () => {
      pulse(btn);
      ctx.audio.sfx('ui');
      opts.onPick(profile);
    });
    grid.append(btn);
  }
  const el = h('div', { class: 'screen profile-screen' }, [grid, opts.corner]);
  isolatePointer(el);
  return { el, dispose: () => el.remove() };
}
