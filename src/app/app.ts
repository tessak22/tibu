import type { AudioSystem, ContentRegistry, GameView, Profile, SavedWorld, ThemeDef, WorldModel, WorldRecord } from '../core/types';
import { persistenceStatus, readImportFile, requestPersistence, type Repository } from '../storage';
import type { UiContext } from '../ui/context';
import { createGallery } from '../ui/gallery';
import { createInstallBanner } from '../ui/install-banner';
import { toast } from '../ui/overlay';
import { openParentArea } from '../ui/parent/parent-area';
import { createParentCorner } from '../ui/parent-gate';
import { createProfilePicker } from '../ui/profile-picker';
import { createRestingScreen } from '../ui/resting';
import type { Screen } from '../ui/screen';
import { pickTheme } from '../ui/theme-picker';
import { APP_VERSION, REPO_URL, SLEEP_SCREEN_DELAY_MS } from './config';
import { exportWorldFile } from './export-io';
import { LANGUAGES } from './languages';
import { detectPlatform } from './platform';
import { createPlaySession, type PlaySession } from './play-session';
import { createSettingsStore } from './settings-store';
import { createSleepController } from './sleep-flow';

export interface AppDeps {
  readonly registry: ContentRegistry;
  readonly audio: AudioSystem;
  readonly view: GameView;
  readonly repo: Repository;
  readonly screenRoot: HTMLElement;
  readonly overlayRoot: HTMLElement;
  readonly stage: HTMLElement;
  readonly worlds: {
    createWorldFromTheme(theme: ThemeDef): WorldModel;
    deserializeWorld(data: SavedWorld): WorldModel;
  };
}

const MSG = {
  save: 'Tibu could not save just now. Your latest blocks may not be kept if you close the app.',
  open: 'That world could not be opened. It is still safe in the grown-up area.',
  create: 'A new world could not be made right now. Please try again.',
} as const;

export async function startApp(deps: AppDeps): Promise<void> {
  const { registry, audio, view, repo, overlayRoot } = deps;
  const settings = createSettingsStore(repo, await repo.getSettings(), () => toast(overlayRoot, MSG.save));
  const ctx: UiContext = { audio, registry, overlayRoot, getSettings: settings.get };
  const platform = detectPlatform(navigator, (q) => window.matchMedia(q));
  let profiles: Profile[] = await repo.ensureProfiles();
  let profile: Profile = profiles[0] as Profile;
  let screen: Screen | null = null;
  let session: PlaySession | null = null;
  let sleeping = false;

  const corner = (): HTMLElement =>
    createParentCorner({ overlayRoot, onUnlock: () => void openParent(), onPlainTap: () => audio.sfx('tap') });

  const mount = (next: Screen, showStage: boolean): void => {
    screen?.dispose();
    screen = next;
    deps.stage.hidden = !showStage;
    deps.screenRoot.append(next.el);
  };

  const leavePlay = async (): Promise<void> => {
    if (!session) return;
    const current = session;
    session = null;
    sleep.pause();
    try {
      await current.leave();
    } catch {
      toast(overlayRoot, MSG.save);
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
    );
  };

  const openWorld = async (record: WorldRecord, preloaded?: WorldModel): Promise<void> => {
    let world: WorldModel;
    try {
      world = preloaded ?? deps.worlds.deserializeWorld(record.data);
    } catch {
      toast(overlayRoot, MSG.open);
      return;
    }
    await leavePlay();
    const next = createPlaySession({
      ctx,
      view,
      repo,
      record,
      world,
      corner: corner(),
      updateSettings: settings.update,
      onBack: () => void showGallery(),
      onSaveError: () => toast(overlayRoot, MSG.save),
    });
    session = next;
    mount(next, true);
    sleep.resume();
  };

  const newWorld = async (): Promise<void> => {
    void audio.speak('pick-theme');
    const theme = await pickTheme(ctx);
    if (!theme) return;
    try {
      const world = deps.worlds.createWorldFromTheme(theme);
      const count = (await repo.listWorlds(profile.id)).filter((w) => w.data.themeId === theme.id).length;
      const record = await repo.createWorld({
        profileId: profile.id,
        name: `${theme.name} ${count + 1}`,
        data: world.serialize(),
      });
      void audio.speak('new-world');
      await openWorld(record, world);
    } catch {
      toast(overlayRoot, MSG.create);
    }
  };

  const goToSleep = async (): Promise<void> => {
    if (sleeping || !session) return;
    sleeping = true;
    session.setDimmed(true);
    audio.sfx('sleep');
    const spoken = audio.speak('sleep');
    await Promise.race([spoken, new Promise((r) => setTimeout(r, SLEEP_SCREEN_DELAY_MS))]);
    await leavePlay();
    mount(createRestingScreen(corner()), false);
  };

  const wake = async (): Promise<void> => {
    sleeping = false;
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
    if (session) {
      if (!(await repo.getWorld(session.recordId))) await showGallery();
      return;
    }
    if (sleeping) return;
    return profiles.length > 1 && screen?.el.classList.contains('profile-screen') ? showProfiles() : showGallery();
  };

  const openParent = async (): Promise<void> => {
    if (sleeping) return wake();
    sleep.pause();
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
    });
    await refreshAfterParent();
    if (session) sleep.resume();
  };

  // Every tap anywhere unlocks audio (browsers require a gesture) and gets a response.
  window.addEventListener('pointerdown', () => audio.unlock(), { capture: true, passive: true });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  deps.stage.hidden = true;
  view.setActive(false);
  applyMotion(settings.get().reducedMotion);
  audio.applySettings(settings.get());
  void requestPersistence();

  await (profiles.length > 1 ? showProfiles() : showGallery());
}
