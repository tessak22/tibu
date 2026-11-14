import type { AudioSystem, Cell, ContentRegistry, GameView, Profile, WorldModel } from '../core/types';
import { createExplorer, drawSticker, STICKERS, variantForAnimal } from '../explore/index';
import type { Repository } from '../storage';
import type { UiContext } from '../ui/context';
import { openStickerBook } from '../ui/sticker-book';
import type { ExploreSetup } from './world-factory';

export interface ExploreSessionDeps {
  readonly ctx: UiContext;
  readonly view: GameView;
  readonly world: WorldModel;
  readonly registry: ContentRegistry;
  readonly audio: AudioSystem;
  readonly repo: Pick<Repository, 'addSticker'>;
  readonly profile: Profile;
  readonly setup: ExploreSetup;
  /** A chest was opened: its entity changed, so the world needs saving. */
  readonly onWorldChanged: () => void;
  readonly onProfileChanged: (profile: Profile) => void;
  readonly onSaveError: (error: unknown) => void;
}

export interface ExploreSession {
  characterCell(): Cell | null;
  /** Camera follows the character again (walk / build / smash all keep following). */
  follow(): void;
  /** Home button: character back in view, camera behind it. */
  recenter(): void;
  openStickerBook(): void;
  dispose(): void;
}

/** Big adventure worlds: the walking character, roaming animals, chests and the sticker book. */
export function createExploreSession(deps: ExploreSessionDeps): ExploreSession {
  const { view, world, audio } = deps;
  const found = new Set(deps.profile.stickers ?? []);
  let disposed = false;

  const onStickerFound = (id: string): void => {
    deps.onWorldChanged();
    if (found.has(id)) return;
    found.add(id);
    deps.repo.addSticker(deps.profile.id, id).then(
      (saved) => {
        if (saved && !disposed) deps.onProfileChanged(saved);
      },
      (error: unknown) => deps.onSaveError(error),
    );
  };

  const explorer = createExplorer({
    view,
    world,
    registry: deps.registry,
    audio,
    spawn: deps.setup.spawn,
    animalSpots: deps.setup.animalSpots,
    reducedMotion: () => deps.ctx.getSettings().reducedMotion,
    variant: variantForAnimal(deps.profile.animal),
    onStickerFound,
    isFound: (id: string) => found.has(id),
  });

  const offWalk = view.on('walkTo', ({ cell }) => explorer.walkTo(cell));

  return {
    characterCell: () => explorer.characterCell(),
    follow: () => explorer.setFollowing(true),
    recenter: () => explorer.recenter(),
    openStickerBook() {
      audio.sfx('ui');
      void openStickerBook(deps.ctx, {
        allIds: STICKERS.map((s) => s.id),
        found: [...found],
        draw: drawSticker,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offWalk();
      explorer.dispose();
    },
  };
}
