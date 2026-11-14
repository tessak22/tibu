import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Profile, Settings, WorldRecord } from '../core/types';

export const DB_NAME = 'tibu';
export const DB_VERSION = 1;
export const SETTINGS_KEY = 'device';

export interface TibuDB extends DBSchema {
  profiles: { key: string; value: Profile };
  worlds: { key: string; value: WorldRecord; indexes: { byProfile: string } };
  settings: { key: string; value: Partial<Settings> };
}

export type TibuDatabase = IDBPDatabase<TibuDB>;

/** Opens (and creates or upgrades) the Tibu IndexedDB database. */
export function openTibuDB(name: string = DB_NAME): Promise<TibuDatabase> {
  return openDB<TibuDB>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('worlds')) {
        const worlds = db.createObjectStore('worlds', { keyPath: 'id' });
        worlds.createIndex('byProfile', 'profileId');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
}
