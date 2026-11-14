import { describe, expect, it } from 'vitest';
import { persistenceStatus, requestPersistence } from '../../../src/storage/persist';

describe('persistence', () => {
  it('handles missing API', async () => {
    expect(await requestPersistence(undefined)).toBe('unsupported');
    expect(await persistenceStatus(undefined)).toBe('unsupported');
  });
  it('requests persistence', async () => {
    expect(await requestPersistence({ persisted: async () => false, persist: async () => true })).toBe('persisted');
    expect(await requestPersistence({ persist: async () => false })).toBe('not-persisted');
  });
  it('never throws', async () => {
    const boom = async (): Promise<boolean> => {
      throw new Error('x');
    };
    expect(await requestPersistence({ persist: boom })).toBe('not-persisted');
    expect(await persistenceStatus({ persisted: boom })).toBe('not-persisted');
  });
});
