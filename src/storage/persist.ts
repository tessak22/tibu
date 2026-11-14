export type PersistStatus = 'persisted' | 'not-persisted' | 'unsupported';

interface StorageLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

const storageApi = (): StorageLike | undefined =>
  typeof navigator !== 'undefined' ? (navigator.storage as StorageLike | undefined) : undefined;

/** Asks the browser not to evict saved worlds. Never throws. */
export async function requestPersistence(storage: StorageLike | undefined = storageApi()): Promise<PersistStatus> {
  if (!storage?.persist) return 'unsupported';
  try {
    if (storage.persisted && (await storage.persisted())) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}

export async function persistenceStatus(storage: StorageLike | undefined = storageApi()): Promise<PersistStatus> {
  if (!storage?.persisted) return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}
