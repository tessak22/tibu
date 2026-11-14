import type { PlayMode, Profile } from '../../core/types';
import { profileMode } from '../../storage/profiles';
import { animalChoices, animalPicture } from '../animals';
import { clear, h, pulse } from '../dom';
import { confirmDialog } from '../overlay';
import { message, section, textButton } from './controls';
import { MODE_LABELS, modeSwitch } from './mode-switch';
import type { ParentAreaDeps } from './types';

const errorText = 'Something went wrong saving profiles. Please try again.';

export function profilesSection(deps: ParentAreaDeps): HTMLElement {
  const { ctx, repo } = deps;
  const list = h('ul', { class: 'profile-list' });
  const msg = message();
  let chosenAnimal: string | null = null;
  const newMode = modeSwitch('little', 'New player mode', () => undefined);

  const picker = h('div', { class: 'animal-picker' });
  for (const choice of animalChoices(ctx.registry)) {
    const btn = h('button', { type: 'button', class: 'animal-choice', 'aria-label': choice.id }, [choice.picture(96)]);
    btn.addEventListener('click', () => {
      chosenAnimal = choice.id;
      for (const b of picker.querySelectorAll('.animal-choice')) b.classList.toggle('selected', b === btn);
      pulse(btn);
    });
    picker.append(btn);
  }

  const render = async (): Promise<void> => {
    let profiles: Profile[];
    try {
      profiles = await repo.listProfiles();
    } catch {
      msg.show('Could not load profiles.');
      return;
    }
    clear(list);
    for (const p of profiles) {
      const isCurrent = p.id === deps.currentProfileId;
      const remove = textButton('Remove', () => void removeProfile(p, profiles.length), 'small danger');
      remove.disabled = profiles.length <= 1;
      const mode = modeSwitch(profileMode(p), `${p.animal} mode`, (next) => void changeMode(p, next, mode));
      list.append(
        h('li', { 'data-profile': p.id }, [
          animalPicture(ctx.registry, p.animal, 64),
          h('span', {}, [`${p.animal}${isCurrent ? ' (playing now)' : ''}`]),
          mode.el,
          remove,
        ]),
      );
    }
  };

  const removeProfile = async (p: Profile, count: number): Promise<void> => {
    if (count <= 1) return;
    const ok = await confirmDialog(
      ctx.overlayRoot,
      `Remove the ${p.animal} player? All of their worlds will be deleted from this device. This cannot be undone.`,
      'Remove player',
    );
    if (!ok) return;
    try {
      await repo.deleteProfile(p.id);
      msg.show('Player removed.', 'ok');
      deps.onDataChanged();
    } catch {
      msg.show(errorText);
    }
    await render();
  };

  const changeMode = async (p: Profile, next: PlayMode, control: ReturnType<typeof modeSwitch>): Promise<void> => {
    control.setDisabled(true);
    try {
      const saved = await repo.setProfileMode(p.id, next);
      if (!saved) throw new Error('profile missing');
      msg.show(`The ${p.animal} player is now a ${MODE_LABELS[next].toLowerCase()}. Stickers and worlds are kept.`, 'ok');
      deps.onDataChanged();
    } catch {
      control.set(profileMode(p));
      msg.show(errorText);
    }
    control.setDisabled(false);
  };

  const add = async (): Promise<void> => {
    if (!chosenAnimal) {
      msg.show('Pick an animal picture first.');
      return;
    }
    try {
      await repo.createProfile(chosenAnimal, newMode.value());
      msg.show('Player added.', 'ok');
      deps.onDataChanged();
    } catch {
      msg.show(errorText);
    }
    await render();
  };

  void render();
  return section('Players', [
    h('p', { class: 'hint' }, ['With more than one player, Tibu starts by showing each player’s animal picture.']),
    list,
    h('h3', {}, ['Add a player']),
    picker,
    h('p', { class: 'hint' }, [
      'Little builders get a small island and build cards. Big builders also get a big world to walk around, ',
      'step-by-step builds, more parts and stickers to find. You can switch at any time; nothing is lost.',
    ]),
    newMode.el,
    textButton('Add player', () => void add(), 'primary'),
    msg.el,
  ]);
}
