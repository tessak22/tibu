import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/core/types';
import { createRepository, type Repository } from '../../../src/storage/repository';
import { openTibuDB, SETTINGS_KEY } from '../../../src/storage/db';
import { sampleWorld, uniqueDbName } from './fixtures';

let repo: Repository;
let dbName: string;
let clock = 1000;

beforeEach(async () => {
  dbName = uniqueDbName();
  clock = 1000;
  repo = await createRepository(dbName, () => clock++);
});

afterEach(() => repo.close());

describe('worlds', () => {
  it('saves and loads a world', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: '  Castle  ', data: sampleWorld() });
    expect(created.name).toBe('Castle');
    const loaded = await repo.getWorld(created.id);
    expect(loaded).toEqual(created);
    expect(await repo.getWorld('missing')).toBeNull();
  });

  it('persists across repository instances', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: 'A', data: sampleWorld(2) });
    repo.close();
    repo = await createRepository(dbName);
    expect((await repo.getWorld(created.id))?.data).toEqual(sampleWorld(2));
  });

  it('updates data immutably and bumps updatedAt', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: 'A', data: sampleWorld() });
    const updated = await repo.updateWorld(created.id, { data: sampleWorld(3) });
    expect(updated?.data.blocks).toHaveLength(5);
    expect(updated?.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(created.data.blocks).toHaveLength(2);
    expect(await repo.updateWorld('missing', { name: 'x' })).toBeNull();
  });

  it('stores thumbnails without changing updatedAt', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: 'A', data: sampleWorld() });
    const thumb = new Blob(['png'], { type: 'image/png' });
    const updated = await repo.updateWorld(created.id, { thumbnail: thumb });
    expect(updated?.updatedAt).toBe(created.updatedAt);
    expect((await repo.getWorld(created.id))?.thumbnail).toBeTruthy();
  });

  it('lists worlds per profile, newest first', async () => {
    const a = await repo.createWorld({ profileId: 'p1', name: 'A', data: sampleWorld() });
    const b = await repo.createWorld({ profileId: 'p1', name: 'B', data: sampleWorld() });
    await repo.createWorld({ profileId: 'p2', name: 'C', data: sampleWorld() });
    await repo.updateWorld(a.id, { data: sampleWorld(1) });
    const list = await repo.listWorlds('p1');
    expect(list.map((w) => w.name)).toEqual(['A', 'B']);
    expect(list.map((w) => w.id)).toContain(b.id);
    expect(await repo.listAllWorlds()).toHaveLength(3);
  });

  it('renames with trimming and keeps the old name when blank', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: 'A', data: sampleWorld() });
    expect((await repo.renameWorld(created.id, '  Big   house '))?.name).toBe('Big house');
    expect((await repo.renameWorld(created.id, '   '))?.name).toBe('Big house');
    expect((await repo.renameWorld(created.id, 'x'.repeat(200)))?.name).toHaveLength(60);
  });

  it('duplicates a world into a new record', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: 'Farm', data: sampleWorld(1) });
    const copy = await repo.duplicateWorld(created.id);
    expect(copy?.id).not.toBe(created.id);
    expect(copy?.name).toBe('Farm (copy)');
    expect(copy?.data).toEqual(created.data);
    expect(await repo.listWorlds('p1')).toHaveLength(2);
    expect(await repo.duplicateWorld('missing')).toBeNull();
  });

  it('deletes a world', async () => {
    const created = await repo.createWorld({ profileId: 'p1', name: 'A', data: sampleWorld() });
    await repo.deleteWorld(created.id);
    expect(await repo.getWorld(created.id)).toBeNull();
  });
});

describe('profiles', () => {
  it('auto-creates a default profile once', async () => {
    const first = await repo.ensureProfiles();
    expect(first).toHaveLength(1);
    const again = await repo.ensureProfiles();
    expect(again.map((p) => p.id)).toEqual(first.map((p) => p.id));
  });

  it('creates, lists in order, and deletes profiles with their worlds', async () => {
    const fox = await repo.createProfile('fox');
    const cat = await repo.createProfile('cat');
    expect((await repo.listProfiles()).map((p) => p.animal)).toEqual(['fox', 'cat']);
    expect(await repo.getProfile(cat.id)).toEqual(cat);
    await repo.createWorld({ profileId: cat.id, name: 'Cat world', data: sampleWorld() });
    await repo.createWorld({ profileId: fox.id, name: 'Fox world', data: sampleWorld() });
    await repo.deleteProfile(cat.id);
    expect(await repo.getProfile(cat.id)).toBeNull();
    expect(await repo.listWorlds(cat.id)).toHaveLength(0);
    expect(await repo.listWorlds(fox.id)).toHaveLength(1);
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and reloads settings', async () => {
    const next = { ...DEFAULT_SETTINGS, muted: true, playTimerMinutes: 20, customWords: ['MIA'] };
    await repo.saveSettings(next);
    expect(await repo.getSettings()).toEqual(next);
  });

  it('merges old stored settings with new defaults', async () => {
    repo.close();
    const db = await openTibuDB(dbName);
    await db.put('settings', { muted: true, learning: { naming: false } } as never, SETTINGS_KEY);
    db.close();
    repo = await createRepository(dbName);
    const s = await repo.getSettings();
    expect(s.muted).toBe(true);
    expect(s.learning).toEqual({ ...DEFAULT_SETTINGS.learning, naming: false });
    expect(s.voiceOn).toBe(DEFAULT_SETTINGS.voiceOn);
  });
});
