import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/core/types';
import { openTibuDB, SETTINGS_KEY } from '../../../src/storage/db';
import { normalizeProfile, profileMode, withMode, withSticker } from '../../../src/storage/profiles';
import { createRepository, type Repository } from '../../../src/storage/repository';
import { mergeSettings } from '../../../src/storage/settings';
import { uniqueDbName } from './fixtures';

let repo: Repository;
let dbName: string;
let clock = 1000;

beforeEach(async () => {
  dbName = uniqueDbName();
  clock = 1000;
  repo = await createRepository(dbName, () => clock++);
});

afterEach(() => repo.close());

/** Writes a raw record the way Tibu v1 stored it (no mode, no stickers). */
async function writeRaw(store: 'profiles', value: unknown): Promise<void> {
  repo.close();
  const db = await openTibuDB(dbName);
  await db.put(store, value as never);
  db.close();
  repo = await createRepository(dbName, () => clock++);
}

describe('normalizeProfile', () => {
  it('migrates a v1 profile to little mode with no stickers', () => {
    expect(normalizeProfile({ id: 'a', animal: 'dog', createdAt: 5 })).toEqual({
      id: 'a',
      animal: 'dog',
      mode: 'little',
      stickers: [],
      createdAt: 5,
    });
  });

  it('keeps valid fields and cleans damaged ones', () => {
    const p = normalizeProfile({ id: 'a', animal: '', mode: 'huge', stickers: ['star', 'star', 7, 'Bad Id'], createdAt: 'x' });
    expect(p).toEqual({ id: 'a', animal: 'cat', mode: 'little', stickers: ['star'], createdAt: 0 });
    expect(normalizeProfile({ id: 'b', animal: 'fox', mode: 'big', createdAt: 1 })?.mode).toBe('big');
  });

  it('rejects records that are not profiles', () => {
    expect(normalizeProfile(null)).toBeNull();
    expect(normalizeProfile({ animal: 'cat' })).toBeNull();
    expect(normalizeProfile('cat')).toBeNull();
  });

  it('withSticker and withMode never mutate and never drop stickers', () => {
    const p = normalizeProfile({ id: 'a', animal: 'cat', createdAt: 1 })!;
    const s = withSticker(p, 'shell');
    expect(p.stickers).toEqual([]);
    expect(s.stickers).toEqual(['shell']);
    expect(withSticker(s, 'shell')).toBe(s);
    const big = withMode(s, 'big');
    expect(big.stickers).toEqual(['shell']);
    expect(profileMode(big)).toBe('big');
    expect(profileMode({})).toBe('little');
  });
});

describe('repository profiles', () => {
  it('existing v1 profiles read back as little builders', async () => {
    await writeRaw('profiles', { id: 'old', animal: 'cow', createdAt: 1 });
    const [p] = await repo.listProfiles();
    expect(p).toMatchObject({ id: 'old', animal: 'cow', mode: 'little', stickers: [] });
    expect(await repo.getProfile('old')).toEqual(p);
  });

  it('creates a profile with the chosen mode (little by default)', async () => {
    const little = await repo.createProfile('cat');
    const big = await repo.createProfile('fox', 'big');
    expect(little.mode).toBe('little');
    expect(big.mode).toBe('big');
    expect((await repo.getProfile(big.id))?.mode).toBe('big');
  });

  it('addSticker stores each sticker once and survives mode switches', async () => {
    const p = await repo.createProfile('cat', 'big');
    await repo.addSticker(p.id, 'shell');
    await repo.addSticker(p.id, 'shell');
    await Promise.all([repo.addSticker(p.id, 'rainbow'), repo.addSticker(p.id, 'crown')]);
    expect((await repo.getProfile(p.id))?.stickers).toEqual(['shell', 'rainbow', 'crown']);
    await repo.setProfileMode(p.id, 'little');
    await repo.setProfileMode(p.id, 'big');
    const after = await repo.getProfile(p.id);
    expect(after?.mode).toBe('big');
    expect(after?.stickers).toEqual(['shell', 'rainbow', 'crown']);
  });

  it('addSticker migrates a v1 profile and ignores unknown players', async () => {
    await writeRaw('profiles', { id: 'old', animal: 'cow', createdAt: 1 });
    expect((await repo.addSticker('old', 'star'))?.stickers).toEqual(['star']);
    expect(await repo.addSticker('missing', 'star')).toBeNull();
    expect(await repo.setProfileMode('missing', 'big')).toBeNull();
  });
});

describe('settings migration', () => {
  it('older stored settings get topple on by default', async () => {
    repo.close();
    const db = await openTibuDB(dbName);
    await db.put('settings', { muted: true } as never, SETTINGS_KEY);
    db.close();
    repo = await createRepository(dbName);
    const s = await repo.getSettings();
    expect(s.toppleTowers).toBe(true);
    expect(s.muted).toBe(true);
  });

  it('keeps a saved topple choice and rejects garbage', () => {
    expect(mergeSettings({ toppleTowers: false }).toppleTowers).toBe(false);
    expect(mergeSettings({ toppleTowers: 'no' }).toppleTowers).toBe(DEFAULT_SETTINGS.toppleTowers);
  });
});
