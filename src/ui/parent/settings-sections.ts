import type { Settings } from '../../core/types';
import { MAX_CUSTOM_WORDS, normalizeWord, PLAY_TIMER_CHOICES } from '../../storage/settings';
import { clear, h } from '../dom';
import { message, section, select, slider, textButton, toggle } from './controls';
import type { ParentAreaDeps } from './types';

type Update = ParentAreaDeps['updateSettings'];

export function soundSection(s: Settings, update: Update): HTMLElement {
  return section('Sound', [
    toggle('Sound effects', s.sfxOn, (on) => void update((c) => ({ ...c, sfxOn: on }))),
    slider('Sound effects volume', s.sfxVolume, (v) => void update((c) => ({ ...c, sfxVolume: v }))),
    toggle('Music', s.musicOn, (on) => void update((c) => ({ ...c, musicOn: on }))),
    slider('Music volume', s.musicVolume, (v) => void update((c) => ({ ...c, musicVolume: v }))),
    toggle('Voice', s.voiceOn, (on) => void update((c) => ({ ...c, voiceOn: on }))),
    slider('Voice volume', s.voiceVolume, (v) => void update((c) => ({ ...c, voiceVolume: v }))),
    toggle('Mute everything', s.muted, (on) => void update((c) => ({ ...c, muted: on }))),
  ]);
}

export function languageSection(deps: ParentAreaDeps, s: Settings): HTMLElement {
  const options = deps.languages.map((l) => ({ value: l.code, label: l.name }));
  return section('Language', [
    select('Spoken language', options, s.language, (code) => void deps.updateSettings((c) => ({ ...c, language: code }))),
  ]);
}

export function packsSection(deps: ParentAreaDeps, s: Settings): HTMLElement {
  const all = deps.ctx.registry.packs;
  const msg = message();
  const isOn = (id: string): boolean => s.enabledPacks.length === 0 || s.enabledPacks.includes(id);
  let current = all.filter((p) => isOn(p.id)).map((p) => p.id);
  const rows = all.map((pack) =>
    toggle(pack.name, isOn(pack.id), (on) => {
      const next = on ? [...current, pack.id] : current.filter((id) => id !== pack.id);
      if (next.length === 0) {
        msg.show('Keep at least one block pack turned on.');
        const input = rows[all.indexOf(pack)]?.querySelector('input');
        if (input) input.checked = true;
        return;
      }
      msg.show('');
      current = next;
      const stored = next.length === all.length ? [] : all.map((p) => p.id).filter((id) => next.includes(id));
      void deps.updateSettings((c) => ({ ...c, enabledPacks: stored }));
    }),
  );
  return section('Block packs', [...rows, msg.el]);
}

export function learningSection(deps: ParentAreaDeps, s: Settings): HTMLElement {
  const set = (key: keyof Settings['learning']) => (on: boolean) =>
    void deps.updateSettings((c) => ({ ...c, learning: { ...c.learning, [key]: on } }));
  return section('Learning', [
    toggle('Say block names', s.learning.naming, set('naming')),
    toggle('Count stacks aloud', s.learning.counting, set('counting')),
    toggle('Spell words with letter blocks', s.learning.spelling, set('spelling')),
    toggle('Build cards', s.learning.buildCards, set('buildCards')),
    wordsEditor(deps, s.customWords),
  ]);
}

function wordsEditor(deps: ParentAreaDeps, initial: readonly string[]): HTMLElement {
  let words = initial;
  const list = h('ul', { class: 'word-list' });
  const msg = message();
  const input = h('input', {
    type: 'text',
    maxlength: 12,
    autocapitalize: 'characters',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'e.g. MIA',
    'aria-label': 'New word',
  });
  const save = (next: readonly string[]): void => {
    words = next;
    render();
    void deps.updateSettings((c) => ({ ...c, customWords: next }));
  };
  const render = (): void => {
    clear(list);
    for (const w of words) {
      list.append(h('li', {}, [h('span', {}, [w]), textButton('Remove', () => save(words.filter((x) => x !== w)), 'small')]));
    }
  };
  const add = (): void => {
    const word = normalizeWord(input.value);
    if (!word) return msg.show('Use 2 to 12 letters, A to Z only (no spaces or accents).');
    if (words.includes(word)) return msg.show(`${word} is already in the list.`);
    if (words.length >= MAX_CUSTOM_WORDS) return msg.show(`You can add up to ${MAX_CUSTOM_WORDS} words.`);
    msg.show('');
    input.value = '';
    save([...words, word]);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });
  render();
  return h('div', { class: 'words' }, [
    h('h3', {}, ['Custom spelling words']),
    h('p', { class: 'hint' }, ["Add words like your child's name. Spelling them with letter blocks celebrates."]),
    h('div', { class: 'row' }, [input, textButton('Add word', add, 'primary')]),
    msg.el,
    list,
  ]);
}

export function playSection(deps: ParentAreaDeps, s: Settings): HTMLElement {
  const options = PLAY_TIMER_CHOICES.map((m) => ({ value: m, label: m === null ? 'Off' : `${m} minutes` }));
  return section('Play', [
    select('Play timer', options, s.playTimerMinutes, (m) => void deps.updateSettings((c) => ({ ...c, playTimerMinutes: m }))),
    h('p', { class: 'hint' }, ['When time is up, the blocks go to sleep gently. Waking them needs this grown-up check.']),
    toggle('Left-handed controls', s.leftHanded, (on) => void deps.updateSettings((c) => ({ ...c, leftHanded: on }))),
    toggle('Reduced motion', s.reducedMotion, (on) => void deps.updateSettings((c) => ({ ...c, reducedMotion: on }))),
  ]);
}
