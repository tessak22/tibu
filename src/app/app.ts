import type { AudioSystem, ContentRegistry, GameView, Profile, WorldModel, WorldRecord } from '../core/types';
import { STICKER_IDS } from '../explore/stickers';
import { persistenceStatus, profileMode, readImportFile, requestPersistence, type Repository } from '../storage';
import type { UiContext } from '../ui/context';
import { createGallery } from '../ui/gallery';
import { createInstallBanner } from '../ui/install-banner';
import { saveHint, toast } from '../ui/overlay';
import { openParentArea } from '../ui/parent/parent-area';
import { createParentCorner } from '../ui/parent-gate';
import { createProfilePicker } from '../ui/profile-picker';
import { createRestingScreen } from '../ui/resting';
import type { Screen } from '../ui/screen';
import { pickTheme } from '../ui/theme-picker';
import {
  APP_VERSION,
  REPO_URL,
  RESTING_FADE_IN_MS,
  SLEEP_FADE_MS,
  SLEEP_FADE_REDUCED_MS,
  SLEEP_SCREEN_DELAY_MS,
} from './config';
import { exportWorldFile } from './export-io';
import { LANGUAGES } from './languages';
import { detectPlatform } from './platform';
import { createPlaySession, type PlaySession } from './play-session';
import { createProblemLog } from './problem-log';
import { createSettingsStore } from './settings-store';
import { createSleepController } from './sleep-flow';
import type { UpdateGate } from './update-gate';
import { createNewWorld, exploreSetupFor, stickersToHide, type ExploreSetup, type WorldFactory } from './world-factory';

export interface AppDeps {
  readonly registry: ContentRegistry;
  readonly audio: AudioSystem;
  readonly view: GameView;
  readonly repo: Repository;
  readonly screenRoot: HTMLElement;
  readonly overlayRoot: HTMLElement;
  readonly stage: HTMLElement;
  readonly worlds: WorldFactory;
  /** Lets a downloaded app update reload only on calm screens. */
  readonly updates?: UpdateGate | null;
}

const MSG = {
  open: 'That world could not be opened. It is still safe in the grown-up area.',
  create: 'A new world could not be made right now. Please try again.',
} as const;

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click'] as const;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function startApp(deps: AppDeps): Promise<void> {
  const { registry, audio, view, repo, overlayRoot } = deps;
  const problems = createProblemLog();
  /** A save failed: log it for the grown-up area and show only a quiet, word-free hint. */
  const onSaveError = (error?: unknown): void => {
    problems.record('save', error);
    saveHint(overlayRoot);
  };
  const settings = createSettingsStore(repo, await repo.getSettings(), () => onSaveError());
  const ctx: UiContext = { audio, registry, overlayRoot, getSettings: settings.get };
  const platform = detectPlatform(navigator, (q) => window.matchMedia(q));
  let profiles: Profile[] = await repo.ensureProfiles();
  let profile: Profile = profiles[0] as Profile;
  let screen: Screen | null = null;
  let session: PlaySession | null = null;
  let sleeping = false;

  const corner = (): HTMLElement =>
    createParentCorner({ overlayRoot, onUnlock: () => void openParent(), onPlainTap: () => audio.sfx('tap') });

  /** `calm`: a gallery or profile screen, where an app update may reload the page. */
  let calmScreen = false;
  const isCalm = (): boolean => calmScreen && !session && !sleeping;
  const mount = (next: Screen, showStage: boolean, calm = false): void => {
    deps.updates?.setSafe(false);
    screen?.dispose();
    screen = next;
    calmScreen = calm;
    deps.stage.hidden = !showStage;
    deps.screenRoot.append(next.el);
    deps.updates?.setSafe(isCalm());
  };

  const leavePlay = async (): Promise<void> => {
    if (!session) return;
    const current = session;
    session = null;
    sleep.pause();
    try {
      await current.leave();
    } catch (error) {
      onSaveError(error);
    }
  };

  const showGallery = async (): Promise<void> => {
    await leavePlay();
    let worlds: WorldRecord[] = [];
    try {
      worlds = await repo.listWorlds(profile.id);
    } catch {
      toast(overlayRoot, MSG.open);
    }
    mount(
      createGallery(ctx, {
        profile,
        worlds,
        onSwitchProfile: profiles.length > 1 ? () => void showProfiles() : null,
        onOpen: (w) => void openWorld(w),
        onNew: () => void newWorld(),
        corner: corner(),
        banner: createInstallBanner(overlayRoot, platform),
      }),
      false,
      true,
    );
  };

  const showProfiles = async (): Promise<void> => {
    await leavePlay();
    mount(
      createProfilePicker(ctx, {
        profiles,
        corner: corner(),
        onPick: (p) => {
          profile = p;
          void showGallery();
        },
      }),
      false,
      true,
    );
  };

  /** Keeps the app's copy of the current player fresh (e.g. a sticker was found). */
  const onProfileChanged = (next: Profile): void => {
    if (next.id === profile.id) profile = next;
    profiles = profiles.map((p) => (p.id === next.id ? next : p));
  };

  const openWorld = async (
    record: WorldRecord,
    preloaded?: { world: WorldModel; explore: ExploreSetup | null },
  ): Promise<void> => {
    let world: WorldModel;
    let explore: ExploreSetup | null = null;
    const playMode = profileMode(profile);
    try {
      world = preloaded?.world ?? deps.worlds.deserializeWorld(record.data);
      if (world.kind === 'explore') {
        explore =
          preloaded?.explore ??
          exploreSetupFor(deps.worlds, world, registry.theme(world.themeId), record.data.seed);
      }
    } catch {
      toast(overlayRoot, MSG.open);
      return;
    }
    await leavePlay();
    const next = createPlaySession({
      profile,
      playMode,
      // A little builder can still open an older adventure world: it plays as a plain world.
      explore: playMode === 'big' ? explore : null,
      onProfileChanged,
      ctx,
      view,
      repo,
      record,
      world,
      corner: corner(),
      updateSettings: settings.update,
      onBack: () => void showGallery(),
      onSaveError,
      onThumbnailError: (error) => problems.record('thumbnail', error),
    });
    session = next;
    mount(next, true);
    sleep.resume();
  };

  const newWorld = async (): Promise<void> => {
    void audio.speak('pick-theme');
    deps.updates?.setSafe(false);
    const choice = await pickTheme(ctx, profileMode(profile));
    if (!choice) {
      deps.updates?.setSafe(isCalm());
      return;
    }
    const { theme, kind } = choice;
    try {
      const made = createNewWorld(deps.worlds, theme, kind, stickersToHide(STICKER_IDS, profile));
      const label = kind === 'explore' ? `${theme.name} adventure` : theme.name;
      const sameKind = (await repo.listWorlds(profile.id)).filter(
        (w) => w.data.themeId === theme.id && (w.data.kind ?? 'island') === kind,
      ).length;
      const record = await repo.createWorld({
        profileId: profile.id,
        name: `${label} ${sameKind + 1}`,
        data: made.world.serialize(),
      });
      void audio.speak('new-world');
      await openWorld(record, made);
    } catch {
      toast(overlayRoot, MSG.create);
      deps.updates?.setSafe(isCalm());
    }
  };

  const goToSleep = async (): Promise<void> => {
    if (sleeping || !session) return;
    sleeping = true;
    session.setDimmed(true);
    audio.setMusicSuspended(true);
    audio.sfx('sleep');
    const spoken = audio.speak('sleep');
    const fadeMs = settings.get().reducedMotion ? SLEEP_FADE_REDUCED_MS : SLEEP_FADE_MS;
    // Let the twilight finish and the sleep line end (capped, in case speech never settles).
    await Promise.all([delay(fadeMs), Promise.race([spoken, delay(SLEEP_SCREEN_DELAY_MS)])]);
    if (!sleeping) return; // Woken (parent corner) while fading.
    await leavePlay();
    if (!sleeping) return;
    // Keep the dimmed scene underneath while the resting screen fades in over it.
    const resting = createRestingScreen(corner());
    mount(resting, true);
    setTimeout(() => {
      if (screen === resting) deps.stage.hidden = true;
    }, RESTING_FADE_IN_MS);
  };

  const wake = async (): Promise<void> => {
    sleeping = false;
    audio.setMusicSuspended(false);
    view.setDimmed(false);
    sleep.reset();
    void audio.speak('wake');
    await refreshAfterParent();
  };

  const sleep = createSleepController(settings.get(), () => void goToSleep());

  const applyMotion = (on: boolean): void => {
    document.documentElement.classList.toggle('reduced-motion', on);
    view.setReducedMotion(on);
  };

  settings.subscribe((next) => {
    audio.applySettings(next);
    applyMotion(next.reducedMotion);
    session?.applySettings(next);
    sleep.configure(next);
  });

  /** After the parent area: profiles or the open world may have been removed. */
  const refreshAfterParent = async (): Promise<void> => {
    profiles = await repo.ensureProfiles();
    const stillThere = profiles.find((p) => p.id === profile.id);
    if (!stillThere) {
      profile = profiles[0] as Profile;
      return profiles.length > 1 ? showProfiles() : showGallery();
    }
    const modeChanged = profileMode(stillThere) !== profileMode(profile);
    profile = stillThere;
    if (session) {
      const record = await repo.getWorld(session.recordId);
      if (!record) await showGallery();
      // The grown-up switched this child's mode: reopen the world with the new controls.
      else if (modeChanged) {
        await leavePlay(); // Save first, so the reopened world has every block.
        const fresh = await repo.getWorld(record.id);
        await (fresh ? openWorld(fresh) : showGallery());
      }
      return;
    }
    if (sleeping) return;
    return profiles.length > 1 && screen?.el.classList.contains('profile-screen') ? showProfiles() : showGallery();
  };

  const openParent = async (): Promise<void> => {
    if (sleeping) return wake();
    sleep.pause();
    deps.updates?.setSafe(false);
    await openParentArea({
      ctx,
      repo,
      languages: LANGUAGES,
      currentProfileId: profile.id,
      repoUrl: REPO_URL,
      version: APP_VERSION,
      getSettings: settings.get,
      updateSettings: settings.update,
      persistStatus: () => persistenceStatus(),
      requestPersist: () => requestPersistence(),
      exportWorld: (record) => exportWorldFile(record),
      importWorld: async (file) => {
        const result = await readImportFile(file);
        if (!result.ok) return result.error;
        await repo.createWorld({ profileId: profile.id, name: result.name, data: result.world });
        return null;
      },
      onDataChanged: () => undefined,
      lastSaveProblem: () => problems.last('save')?.at ?? null,
    });
    await refreshAfterParent();
    deps.updates?.setSafe(isCalm());
    if (session) sleep.resume();
  };

  // Every tap anywhere unlocks audio. iOS only counts pointerup/touchend/click as user
  // activation (not pointerdown), so listen to all of them; unlock() is idempotent.
  for (const type of UNLOCK_EVENTS) {
    document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
  }
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  deps.stage.hidden = true;
  view.setActive(false);
  applyMotion(settings.get().reducedMotion);
  audio.applySettings(settings.get());
  void requestPersistence();

  await (profiles.length > 1 ? showProfiles() : showGallery());
}
