import type { Profile } from '../../core/types';
import { animalChoices, animalPicture } from '../animals';
import { clear, h, pulse } from '../dom';
import { confirmDialog } from '../overlay';
import { message, section, textButton } from './controls';
import type { ParentAreaDeps } from './types';

const errorText = 'Something went wrong saving profiles. Please try again.';

export function profilesSection(deps: ParentAreaDeps): HTMLElement {
  const { ctx, repo } = deps;
  const list = h('ul', { class: 'profile-list' });
  const msg = message();
  let chosenAnimal: string | null = null;

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
      list.append(
        h('li', {}, [
          animalPicture(ctx.registry, p.animal, 64),
          h('span', {}, [`${p.animal}${isCurrent ? ' (playing now)' : ''}`]),
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

  const add = async (): Promise<void> => {
    if (!chosenAnimal) {
      msg.show('Pick an animal picture first.');
      return;
    }
    try {
      await repo.createProfile(chosenAnimal);
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
    textButton('Add player', () => void add(), 'primary'),
    msg.el,
  ]);
}
