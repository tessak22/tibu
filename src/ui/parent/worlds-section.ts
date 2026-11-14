import type { WorldRecord } from '../../core/types';
import { clear, h } from '../dom';
import { confirmDialog } from '../overlay';
import { message, section, textButton } from './controls';
import type { ParentAreaDeps } from './types';

const SAVE_ERROR = 'That did not work. Your worlds are unchanged. Please try again.';

export function worldsSection(deps: ParentAreaDeps): HTMLElement {
  const { ctx, repo } = deps;
  const list = h('ul', { class: 'world-list' });
  const msg = message();

  const run = async (task: () => Promise<unknown>, done?: string): Promise<void> => {
    try {
      await task();
      if (done) msg.show(done, 'ok');
      deps.onDataChanged();
    } catch {
      msg.show(SAVE_ERROR);
    }
    await render();
  };

  const renameRow = (w: WorldRecord, li: HTMLElement): void => {
    const input = h('input', { type: 'text', value: w.name, maxlength: 60, 'aria-label': 'World name' });
    const save = textButton('Save', () => void run(() => repo.renameWorld(w.id, input.value), 'Renamed.'), 'primary small');
    const cancel = textButton('Cancel', () => void render(), 'small');
    clear(li);
    li.append(input, save, cancel);
    input.focus();
  };

  const row = (w: WorldRecord): HTMLElement => {
    const li = h('li', {}, [
      h('span', { class: 'world-name' }, [w.name]),
      h('span', { class: 'world-date' }, [new Date(w.updatedAt).toLocaleDateString()]),
    ]);
    const actions = h('div', { class: 'row' }, [
      textButton('Rename', () => renameRow(w, li), 'small'),
      textButton('Duplicate', () => void run(() => repo.duplicateWorld(w.id), 'Copied.'), 'small'),
      textButton('Export', () => void run(() => deps.exportWorld(w)), 'small'),
      textButton('Delete', () => void remove(w), 'small danger'),
    ]);
    li.append(actions);
    return li;
  };

  const remove = async (w: WorldRecord): Promise<void> => {
    const ok = await confirmDialog(ctx.overlayRoot, `Delete “${w.name}”? This cannot be undone.`, 'Delete world');
    if (ok) await run(() => repo.deleteWorld(w.id), 'Deleted.');
  };

  const render = async (): Promise<void> => {
    let worlds: WorldRecord[];
    try {
      worlds = await repo.listWorlds(deps.currentProfileId);
    } catch {
      msg.show('Could not load worlds.');
      return;
    }
    clear(list);
    if (worlds.length === 0) list.append(h('li', { class: 'hint' }, ['No worlds yet.']));
    for (const w of worlds) list.append(row(w));
  };

  const fileInput = h('input', { type: 'file', accept: '.json,.tibu.json,application/json', hidden: true });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    void (async () => {
      const error = await deps.importWorld(file);
      if (error) msg.show(error);
      else {
        msg.show('World imported.', 'ok');
        deps.onDataChanged();
      }
      await render();
    })();
  });

  void render();
  return section('Worlds', [
    h('p', { class: 'hint' }, ['Worlds for the current player. Export saves a .tibu.json file you can import on another device.']),
    list,
    h('div', { class: 'row' }, [textButton('Import a world…', () => fileInput.click(), 'primary'), fileInput]),
    msg.el,
  ]);
}
