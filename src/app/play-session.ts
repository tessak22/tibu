import type { BlockKey, Blueprint, GameView, Mode, PlayMode, Profile, ResolvedPack, Settings, WorldModel, WorldRecord } from '../core/types';
import { cardsForMode, createLearning } from '../learning/index';
import { type Repository } from '../storage';
import type { UiContext } from '../ui/context';
import { pickBlueprint } from '../ui/blueprint-picker';
import { createHud, type Hud } from '../ui/hud';
import { pickPack, playablePacks } from '../ui/pack-picker';
import type { Screen } from '../ui/screen';
import type { AnchorPlace } from './blueprint-anchor';
import { createBlueprintController } from './blueprints';
import { createCardCycler } from './cards';
import { createExploreSession, type ExploreSession } from './explore-session';
import { takePhoto } from './photo';
import { createSessionSaver } from './session-save';
import { installExploreProbes } from './testHook-explore';
import { trackGhosts } from './tracked-view';
import { wireViewEvents } from './view-events';
import { centerStandCell, type ExploreSetup } from './world-factory';

export interface PlaySessionDeps {
  readonly ctx: UiContext;
  readonly view: GameView;
  readonly repo: Repository;
  readonly record: WorldRecord;
  readonly world: WorldModel;
  readonly corner: HTMLElement;
  /** The child's profile; its mode picks the HUD and content. */
  readonly profile: Profile;
  readonly playMode: PlayMode;
  /** Present for explore (big adventure) worlds in big-kid mode. */
  readonly explore: ExploreSetup | null;
  updateSettings(update: (s: Settings) => Settings): Promise<void>;
  onBack(): void;
  onSaveError(error: unknown): void;
  /** Best effort: the world itself is already saved. */
  onThumbnailError(error: unknown): void;
  /** A sticker was found and saved. */
  onProfileChanged(profile: Profile): void;
}

export interface PlaySession extends Screen {
  readonly recordId: string;
  applySettings(s: Settings): void;
  /** Saves everything and refreshes the gallery thumbnail. */
  leave(): Promise<void>;
  setDimmed(on: boolean): void;
}

type ToppleView = GameView & { setTopple?(on: boolean): void };

const MODE_LINES: Readonly<Record<Mode, readonly [string, string]>> = {
  build: ['build-mode', 'build'],
  smash: ['smash-mode', 'smash'],
  walk: ['walk-mode', 'walk'],
};

export function createPlaySession(deps: PlaySessionDeps): PlaySession {
  const { ctx, record, world, playMode } = deps;
  const { audio, registry } = ctx;
  const big = playMode === 'big';
  const tracked = trackGhosts(deps.view);
  const view: ToppleView = tracked.view;
  const theme = registry.theme(world.themeId);
  let mode: Mode = 'build';
  let packs: readonly ResolvedPack[] = playablePacks(registry.packs, ctx.getSettings().enabledPacks, playMode);
  let pack: ResolvedPack | undefined = packs[0];
  let selected: BlockKey | null = pack?.blocks[0]?.key ?? null;
  let disposed = false;
  let explore: ExploreSession | null = null;

  const saver = createSessionSaver({
    view,
    repo: deps.repo,
    record,
    world,
    exploreState: () => {
      const setup = deps.explore;
      if (!setup || !explore) return null;
      const lastCell = explore.characterCell();
      return {
        spawn: setup.home ?? setup.spawn,
        animalSpots: setup.animalSpots,
        ...(lastCell ? { lastCell } : {}),
      };
    },
    onSaveError: deps.onSaveError,
    onThumbnailError: deps.onThumbnailError,
  });
  const learning = createLearning({
    view,
    getWorld: () => world,
    audio,
    registry,
    getSettings: ctx.getSettings,
    getMode: () => playMode,
  });

  const setMode = (next: Mode): void => {
    mode = next === 'walk' && !explore ? 'build' : next;
    view.setMode(mode);
    hud.setMode(mode);
    explore?.follow();
  };

  const selectBlock = (key: BlockKey): void => {
    selected = key;
    view.setSelectedBlock(key);
    audio.sfx('tap');
    if (mode !== 'build') setMode('build');
  };

  const showPack = (next: ResolvedPack, keepSelection: boolean, prefer: BlockKey | null = null): void => {
    pack = next;
    const keep = keepSelection && selected && next.blocks.some((b) => b.key === selected);
    const wanted = prefer && next.blocks.some((b) => b.key === prefer) ? prefer : null;
    selected = wanted ?? (keep ? selected : (next.blocks[0]?.key ?? null));
    hud.setPack(next, selected);
    if (selected) view.setSelectedBlock(selected);
  };

  /** A build's suggested block: switch the tray to its pack and select it (no sound, no mode change). */
  const suggestBlock = (key: BlockKey): void => {
    const owner = packs.find((p) => p.blocks.some((b) => b.key === key));
    if (owner && owner.id !== pack?.id) showPack(owner, false, key);
    selected = key;
    view.setSelectedBlock(key);
    hud.setSelected(key);
  };

  const hud: Hud = createHud(
    {
      onMode(next) {
        audio.sfx('mode');
        const [line, text] = MODE_LINES[next];
        void audio.speak(line, text);
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
        explore?.recenter();
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
      onBuilds() {
        audio.sfx('ui');
        void pickBlueprint(ctx, registry.blueprints, picture, blueprints.current()?.id ?? null).then((bp) => {
          if (!bp || disposed) return;
          blueprints.start(bp);
          // Ready to place the first piece (still following the character).
          if (blueprints.current() && mode !== 'build') setMode('build');
        });
      },
      onStickers: () => explore?.openStickerBook(),
      onStopBlueprint() {
        audio.sfx('ui');
        blueprints.stop();
      },
    },
    deps.corner,
  );

  const picture = (bp: Blueprint, size: number): HTMLCanvasElement => learning.blueprintPicture(bp, size);

  const blueprints = createBlueprintController({
    learning,
    world,
    picture,
    place: (): AnchorPlace => {
      const character = explore?.characterCell() ?? null;
      if (character) return { kind: 'explore', character, facing: view.placementRotation() };
      const middle = centerStandCell(world);
      return { kind: 'island', center: { x: middle.x, z: middle.z } };
    },
    showProgress: (p) => hud.setBlueprintProgress(p),
    suggest: suggestBlock,
    onDone: () => undefined, // Learning celebrates; the indicator clears itself shortly after.
    // No spot even after a wider search: the builds button wiggles with a soft sound. Never a failure sound.
    onNoRoom: () => {
      hud.nudgeBuilds();
      audio.sfx('tap');
    },
  });

  const cards = createCardCycler({
    cards: cardsForMode(registry.cards, playMode),
    learning,
    audio,
    show: (cardPicture) => hud.setCardPicture(cardPicture),
  });

  const toppleOn = (): boolean => big && ctx.getSettings().toppleTowers;
  const offEvents = wireViewEvents(view, world, audio, registry, { topple: toppleOn });
  const offChange = world.onChange(() => {
    saver.markDirty();
    hud.setUndoAvailable(world.canUndo());
  });

  const applySettings = (s: Settings): void => {
    hud.setMuted(s.muted);
    hud.setLeftHanded(s.leftHanded);
    const modeCards = cardsForMode(registry.cards, playMode);
    hud.setCardEnabled(s.learning.buildCards && modeCards.length > 0);
    if (!s.learning.buildCards) cards.clear();
    view.setReducedMotion(s.reducedMotion);
    view.setTopple?.(big && s.toppleTowers);
    packs = playablePacks(registry.packs, s.enabledPacks, playMode);
    const stillEnabled = pack && packs.some((p) => p.id === pack?.id);
    const first = packs[0];
    if (!stillEnabled && first) showPack(first, false);
  };

  view.setWorld(world, theme);
  view.setDimmed(false);
  view.setActive(true);
  hud.setLayout({ playMode, explore: big && deps.explore !== null });
  if (big && deps.explore) {
    explore = createExploreSession({
      ctx,
      view,
      world,
      registry,
      audio,
      repo: deps.repo,
      profile: deps.profile,
      setup: deps.explore,
      onWorldChanged: () => saver.markDirty(),
      onProfileChanged: deps.onProfileChanged,
      onSaveError: deps.onSaveError,
    });
  }
  setMode(explore ? 'walk' : 'build');
  if (pack) showPack(pack, true);
  hud.setUndoAvailable(world.canUndo());
  applySettings(ctx.getSettings());
  const removeProbes = installExploreProbes({
    characterCell: () => explore?.characterCell() ?? null,
    ghosts: tracked.ghosts,
    playMode: () => playMode,
    mode: () => mode,
    worldKind: () => world.kind,
    maxY: () => world.size.y - 1,
  });

  const el = hud.el;
  el.classList.add('screen', 'play-screen');

  return {
    el,
    recordId: record.id,
    applySettings,
    setDimmed: (on) => view.setDimmed(on),
    leave: () => saver.finish(),
    dispose() {
      if (disposed) return;
      disposed = true;
      removeProbes();
      offEvents();
      offChange();
      cards.dispose();
      blueprints.dispose();
      explore?.dispose();
      learning.dispose();
      view.setGhosts(null);
      saver.dispose();
      view.setActive(false);
      el.remove();
    },
  };
}
