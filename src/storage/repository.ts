import type { Profile, SavedWorld, Settings, WorldRecord } from '../core/types';
import { openTibuDB, SETTINGS_KEY, type TibuDatabase } from './db';
import { newId } from './ids';
import { mergeSettings } from './settings';

export const MAX_NAME_LENGTH = 60;
export const DEFAULT_PROFILE_ANIMAL = 'cat';

export interface NewWorldInput {
  readonly profileId: string;
  readonly name: string;
  readonly data: SavedWorld;
  readonly thumbnail?: Blob | null;
}

export interface WorldPatch {
  readonly data?: SavedWorld;
  readonly thumbnail?: Blob | null;
  readonly name?: string;
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
  createProfile(animal: string): Promise<Profile>;
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

export async function createRepository(dbName?: string, now: () => number = Date.now): Promise<Repository> {
  const db: TibuDatabase = await openTibuDB(dbName);

  const getWorld = async (id: string): Promise<WorldRecord | null> => (await db.get('worlds', id)) ?? null;

  const updateWorld = async (id: string, patch: WorldPatch): Promise<WorldRecord | null> => {
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
      updatedAt: patch.data !== undefined || patch.name !== undefined ? now() : current.updatedAt,
    };
    await tx.store.put(next);
    await tx.done;
    return next;
  };

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
    };
    await db.put('worlds', record);
    return record;
  };

  const createProfile = async (animal: string): Promise<Profile> => {
    const profile: Profile = { id: newId(), animal: animal || DEFAULT_PROFILE_ANIMAL, createdAt: now() };
    await db.put('profiles', profile);
    return profile;
  };

  const listProfiles = async (): Promise<Profile[]> =>
    (await db.getAll('profiles')).sort((a, b) => a.createdAt - b.createdAt);

  return {
    listWorlds: async (profileId) => (await db.getAllFromIndex('worlds', 'byProfile', profileId)).sort(byNewest),
    listAllWorlds: async () => (await db.getAll('worlds')).sort(byNewest),
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
      });
    },
    deleteWorld: (id) => db.delete('worlds', id),
    listProfiles,
    getProfile: async (id) => (await db.get('profiles', id)) ?? null,
    createProfile,
    async deleteProfile(id) {
      const tx = db.transaction(['profiles', 'worlds'], 'readwrite');
      const worlds = tx.objectStore('worlds');
      const keys = await worlds.index('byProfile').getAllKeys(id);
      await Promise.all([...keys.map((k) => worlds.delete(k)), tx.objectStore('profiles').delete(id)]);
      await tx.done;
    },
    async ensureProfiles() {
      const existing = await listProfiles();
      return existing.length > 0 ? existing : [await createProfile(DEFAULT_PROFILE_ANIMAL)];
    },
    getSettings: async () => mergeSettings(await db.get('settings', SETTINGS_KEY)),
    async saveSettings(settings) {
      const merged = mergeSettings(settings);
      await db.put('settings', merged, SETTINGS_KEY);
      return merged;
    },
    close: () => db.close(),
  };
}
