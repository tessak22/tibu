import type { BlockKey, GameView, Mode, ResolvedPack, Settings, WorldModel, WorldRecord } from '../core/types';
import { createLearning } from '../learning/index';
import { createAutosaver, type Repository } from '../storage';
import type { UiContext } from '../ui/context';
import { createHud, type Hud } from '../ui/hud';
import { enabledPacks, pickPack } from '../ui/pack-picker';
import type { Screen } from '../ui/screen';
import { createCardCycler } from './cards';
import { THUMB_SIZE } from './config';
import { takePhoto } from './photo';
import { wireViewEvents } from './view-events';

export interface PlaySessionDeps {
  readonly ctx: UiContext;
  readonly view: GameView;
  readonly repo: Repository;
  readonly record: WorldRecord;
  readonly world: WorldModel;
  readonly corner: HTMLElement;
  updateSettings(update: (s: Settings) => Settings): Promise<void>;
  onBack(): void;
  onSaveError(error: unknown): void;
  /** Best effort: the world itself is already saved. */
  onThumbnailError(error: unknown): void;
}

export interface PlaySession extends Screen {
  readonly recordId: string;
  applySettings(s: Settings): void;
  /** Saves everything and refreshes the gallery thumbnail. */
  leave(): Promise<void>;
  setDimmed(on: boolean): void;
}

export function createPlaySession(deps: PlaySessionDeps): PlaySession {
  const { ctx, view, repo, record, world } = deps;
  const { audio, registry } = ctx;
  const theme = registry.theme(world.themeId);
  let mode: Mode = 'build';
  let packs: readonly ResolvedPack[] = enabledPacks(registry.packs, ctx.getSettings().enabledPacks);
  let pack: ResolvedPack | undefined = packs[0];
  let selected: BlockKey | null = pack?.blocks[0]?.key ?? null;
  let disposed = false;

  const autosaver = createAutosaver({
    save: async () => {
      await repo.updateWorld(record.id, { data: world.serialize() });
    },
    saveThumbnail: async () => {
      const blob = await view.snapshot({ ...THUMB_SIZE, galleryAngle: true });
      await repo.updateWorld(record.id, { thumbnail: blob });
    },
    onError: deps.onSaveError,
    onThumbnailError: deps.onThumbnailError,
  });

  const learning = createLearning({ view, getWorld: () => world, audio, registry, getSettings: ctx.getSettings });

  const setMode = (next: Mode): void => {
    mode = next;
    view.setMode(next);
    hud.setMode(next);
  };

  const selectBlock = (key: BlockKey): void => {
    selected = key;
    view.setSelectedBlock(key);
    audio.sfx('tap');
    if (mode !== 'build') setMode('build');
  };

  const showPack = (next: ResolvedPack, keepSelection: boolean): void => {
    pack = next;
    const keep = keepSelection && selected && next.blocks.some((b) => b.key === selected);
    selected = keep ? selected : (next.blocks[0]?.key ?? null);
    hud.setPack(next, selected);
    if (selected) view.setSelectedBlock(selected);
  };

  const hud: Hud = createHud(
    {
      onMode(next) {
        audio.sfx('mode');
        void audio.speak(next === 'build' ? 'build-mode' : 'smash-mode');
        setMode(next);
      },
      onSelectBlock: selectBlock,
      onPackButton() {
        audio.sfx('ui');
        void pickPack(ctx, packs, pack?.id ?? null).then((chosen) => {
          if (!chosen || disposed) return;
          void audio.speak(chosen.voiceLine, chosen.name);
          showPack(chosen, false);
        });
      },
      onUndo() {
        audio.sfx(world.undo() ? 'undo' : 'tap');
      },
      onHome() {
        audio.sfx('whoosh');
        view.resetCamera();
      },
      onBack() {
        audio.sfx('whoosh');
        deps.onBack();
      },
      onPhoto: () => void takePhoto(view, audio, ctx.overlayRoot),
      onToggleMute() {
        const nextMuted = !ctx.getSettings().muted;
        void deps.updateSettings((s) => ({ ...s, muted: nextMuted })).then(() => {
          if (!nextMuted) audio.sfx('ui');
        });
      },
      onCard: () => cards.next(),
    },
    deps.corner,
  );

  const cards = createCardCycler({
    cards: registry.cards,
    learning,
    audio,
    show: (picture) => hud.setCardPicture(picture),
  });

  const offEvents = wireViewEvents(view, world, audio, registry);
  const offChange = world.onChange(() => {
    autosaver.markDirty();
    hud.setUndoAvailable(world.canUndo());
  });
  // Data is enqueued first, so a slow or failing snapshot never holds back the save.
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden') void autosaver.finish();
  };
  const onPageHide = (): void => void autosaver.finish();
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', onPageHide);

  const applySettings = (s: Settings): void => {
    hud.setMuted(s.muted);
    hud.setLeftHanded(s.leftHanded);
    hud.setCardEnabled(s.learning.buildCards && registry.cards.length > 0);
    if (!s.learning.buildCards) cards.clear();
    view.setReducedMotion(s.reducedMotion);
    packs = enabledPacks(registry.packs, s.enabledPacks);
    const stillEnabled = pack && packs.some((p) => p.id === pack?.id);
    const first = packs[0];
    if (!stillEnabled && first) showPack(first, false);
  };

  view.setWorld(world, theme);
  view.setDimmed(false);
  view.setActive(true);
  setMode('build');
  if (pack) showPack(pack, true);
  hud.setUndoAvailable(world.canUndo());
  applySettings(ctx.getSettings());

  const el = hud.el;
  el.classList.add('screen', 'play-screen');

  return {
    el,
    recordId: record.id,
    applySettings,
    setDimmed: (on) => view.setDimmed(on),
    async leave() {
      await autosaver.finish();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offEvents();
      offChange();
      cards.dispose();
      learning.dispose();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      view.setActive(false);
      el.remove();
    },
  };
}
