import type { PlayMode, Profile, SavedExploreState, SavedWorld, Settings, WorldRecord } from '../core/types';
import { openTibuDB, SETTINGS_KEY, type OpenOptions, type TibuDatabase } from './db';
import { newId } from './ids';
import { DEFAULT_PROFILE_ANIMAL, isPlayMode, normalizeProfile, withMode, withSticker } from './profiles';
import { mergeSettings } from './settings';

export const MAX_NAME_LENGTH = 60;
export { DEFAULT_PROFILE_ANIMAL };

export interface NewWorldInput {
  readonly profileId: string;
  readonly name: string;
  readonly data: SavedWorld;
  readonly thumbnail?: Blob | null;
  readonly explore?: SavedExploreState;
}

export interface WorldPatch {
  readonly data?: SavedWorld;
  readonly thumbnail?: Blob | null;
  readonly name?: string;
  /** Adventure worlds: spawn, animal spots and the character's last cell. */
  readonly explore?: SavedExploreState;
}

export interface Repository {
  listWorlds(profileId: string): Promise<WorldRecord[]>;
  listAllWorlds(): Promise<WorldRecord[]>;
  getWorld(id: string): Promise<WorldRecord | null>;
  createWorld(input: NewWorldInput): Promise<WorldRecord>;
  updateWorld(id: string, patch: WorldPatch): Promise<WorldRecord | null>;
  renameWorld(id: string, name: string): Promise<WorldRecord | null>;
  duplicateWorld(id: string): Promise<WorldRecord | null>;
  deleteWorld(id: string): Promise<void>;
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | null>;
  /** New players start in little mode unless the grown-up picks big. */
  createProfile(animal: string, mode?: PlayMode): Promise<Profile>;
  /** Switches a player's mode. Stickers and worlds are kept. Resolves the updated profile. */
  setProfileMode(id: string, mode: PlayMode): Promise<Profile | null>;
  /** Records a found sticker for a player (idempotent). Resolves the updated profile. */
  addSticker(profileId: string, stickerId: string): Promise<Profile | null>;
  /** Deletes the profile and all of its worlds. */
  deleteProfile(id: string): Promise<void>;
  /** Returns the existing profiles, creating a default one if there are none. */
  ensureProfiles(): Promise<Profile[]>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  close(): void;
}

export class RepositoryError extends Error {}

/** Trims and bounds a parent-entered name. Falls back when empty. */
export function cleanName(raw: string, fallback = 'My world'): string {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : fallback;
}

const byNewest = (a: WorldRecord, b: WorldRecord): number => b.updatedAt - a.updatedAt;

/** A connection the browser closed under us (iOS after backgrounding, storage pressure). */
export function isClosedConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === 'InvalidStateError') return true;
  return typeof message === 'string' && /connection.*(clos|lost)|database.*clos/i.test(message);
}

export type DbOpener = (name: string | undefined, options: OpenOptions) => Promise<TibuDatabase>;

export async function createRepository(
  dbName?: string,
  now: () => number = Date.now,
  open: DbOpener = openTibuDB,
): Promise<Repository> {
  let closed = false;
  let connection: Promise<TibuDatabase> | null = null;

  const connect = (): Promise<TibuDatabase> => {
    if (closed) return Promise.reject(new RepositoryError('Tibu: repository is closed'));
    if (!connection) {
      const opening = open(dbName, {
        onTerminated: () => {
          if (connection === opening) connection = null;
        },
      });
      connection = opening;
      opening.catch(() => {
        if (connection === opening) connection = null;
      });
    }
    return connection;
  };

  /** Runs an operation, reopening the database and retrying once if the connection died. */
  const withDb = async <T>(op: (db: TibuDatabase) => Promise<T>): Promise<T> => {
    const db = await connect();
    try {
      return await op(db);
    } catch (error) {
      if (closed || !isClosedConnectionError(error)) throw error;
      if (connection) {
        const stale = connection;
        connection = null;
        void stale.then((d) => d.close(), () => undefined);
      }
      return op(await connect());
    }
  };

  // Open eagerly so a browser without IndexedDB fails at boot, not on the first save.
  await connect();

  const getWorld = (id: string): Promise<WorldRecord | null> =>
    withDb(async (db) => (await db.get('worlds', id)) ?? null);

  const updateWorld = (id: string, patch: WorldPatch): Promise<WorldRecord | null> => withDb(async (db) => {
    const tx = db.transaction('worlds', 'readwrite');
    const current = await tx.store.get(id);
    if (!current) {
      await tx.done;
      return null;
    }
    const next: WorldRecord = {
      ...current,
      ...(patch.data !== undefined ? { data: patch.data } : {}),
      ...(patch.thumbnail !== undefined ? { thumbnail: patch.thumbnail } : {}),
      ...(patch.name !== undefined ? { name: cleanName(patch.name, current.name) } : {}),
      ...(patch.explore !== undefined ? { explore: patch.explore } : {}),
      updatedAt: patch.data !== undefined || patch.name !== undefined ? now() : current.updatedAt,
    };
    await tx.store.put(next);
    await tx.done;
    return next;
  });

  const createWorld = async (input: NewWorldInput): Promise<WorldRecord> => {
    const t = now();
    const record: WorldRecord = {
      id: newId(),
      profileId: input.profileId,
      name: cleanName(input.name),
      createdAt: t,
      updatedAt: t,
      data: input.data,
      thumbnail: input.thumbnail ?? null,
      ...(input.explore ? { explore: input.explore } : {}),
    };
    await withDb((db) => db.put('worlds', record));
    return record;
  };

  const createProfile = async (animal: string, mode: PlayMode = 'little'): Promise<Profile> => {
    const profile: Profile = {
      id: newId(),
      animal: animal || DEFAULT_PROFILE_ANIMAL,
      mode: isPlayMode(mode) ? mode : 'little',
      stickers: [],
      createdAt: now(),
    };
    await withDb((db) => db.put('profiles', profile));
    return profile;
  };

  /** Older profiles (before big-kid mode) are migrated on read; nothing is rewritten until changed. */
  const listProfiles = async (): Promise<Profile[]> =>
    (await withDb((db) => db.getAll('profiles')))
      .map(normalizeProfile)
      .filter((p): p is Profile => p !== null)
      .sort((a, b) => a.createdAt - b.createdAt);

  const getProfile = async (id: string): Promise<Profile | null> =>
    normalizeProfile(await withDb((db) => db.get('profiles', id)));

  /** Read-modify-write in one transaction so concurrent sticker finds never lose one. */
  const patchProfile = (id: string, change: (p: Profile) => Profile): Promise<Profile | null> =>
    withDb(async (db) => {
      const tx = db.transaction('profiles', 'readwrite');
      const current = normalizeProfile(await tx.store.get(id));
      if (!current) {
        await tx.done;
        return null;
      }
      const next = change(current);
      await tx.store.put(next);
      await tx.done;
      return next;
    });

  return {
    listWorlds: async (profileId) =>
      (await withDb((db) => db.getAllFromIndex('worlds', 'byProfile', profileId))).sort(byNewest),
    listAllWorlds: async () => (await withDb((db) => db.getAll('worlds'))).sort(byNewest),
    getWorld,
    createWorld,
    updateWorld,
    renameWorld: (id, name) => updateWorld(id, { name }),
    async duplicateWorld(id) {
      const source = await getWorld(id);
      if (!source) return null;
      return createWorld({
        profileId: source.profileId,
        name: cleanName(`${source.name} (copy)`),
        data: source.data,
        thumbnail: source.thumbnail,
        ...(source.explore ? { explore: source.explore } : {}),
      });
    },
    deleteWorld: (id) => withDb((db) => db.delete('worlds', id)),
    listProfiles,
    getProfile,
    createProfile,
    setProfileMode: (id, mode) =>
      isPlayMode(mode) ? patchProfile(id, (p) => withMode(p, mode)) : Promise.resolve(null),
    addSticker: (profileId, stickerId) => patchProfile(profileId, (p) => withSticker(p, stickerId)),
    deleteProfile: (id) =>
      withDb(async (db) => {
        const tx = db.transaction(['profiles', 'worlds'], 'readwrite');
        const worlds = tx.objectStore('worlds');
        const keys = await worlds.index('byProfile').getAllKeys(id);
        await Promise.all([...keys.map((k) => worlds.delete(k)), tx.objectStore('profiles').delete(id)]);
        await tx.done;
      }),
    async ensureProfiles() {
      const existing = await listProfiles();
      return existing.length > 0 ? existing : [await createProfile(DEFAULT_PROFILE_ANIMAL)];
    },
    getSettings: async () => mergeSettings(await withDb((db) => db.get('settings', SETTINGS_KEY))),
    async saveSettings(settings) {
      const merged = mergeSettings(settings);
      await withDb((db) => db.put('settings', merged, SETTINGS_KEY));
      return merged;
    },
    close() {
      closed = true;
      const current = connection;
      connection = null;
      void current?.then((d) => d.close(), () => undefined);
    },
  };
}
