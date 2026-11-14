import type { WorldEntity } from '../core/types';

export const MAX_ENTITIES = 512;
export const MAX_ENTITY_STRING = 100;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const isShortString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_ENTITY_STRING;

/** Validates an untrusted entity. Returns a clean frozen copy, or null when malformed. */
export function cleanEntity(v: unknown): WorldEntity | null {
  if (!isRecord(v) || v.kind !== 'chest' || !isShortString(v.id) || !isShortString(v.sticker)) return null;
  if (typeof v.opened !== 'boolean' || !isRecord(v.cell)) return null;
  const { x, y, z } = v.cell;
  if (![x, y, z].every((n) => Number.isInteger(n) && Math.abs(n as number) < 1_000_000)) return null;
  return Object.freeze({
    id: v.id,
    kind: 'chest',
    cell: Object.freeze({ x: x as number, y: y as number, z: z as number }),
    sticker: v.sticker,
    opened: v.opened,
  });
}

/** Entity store keyed by id (insertion order kept). Not undoable: opening a chest is permanent. */
export class EntityStore {
  private readonly byId = new Map<string, WorldEntity>();

  list(): readonly WorldEntity[] {
    return Object.freeze([...this.byId.values()]);
  }

  /** Adds or replaces by id. Malformed entities, or new ones past MAX_ENTITIES, are ignored. */
  set(entity: WorldEntity): boolean {
    const clean = cleanEntity(entity);
    if (!clean) return false;
    if (!this.byId.has(clean.id) && this.byId.size >= MAX_ENTITIES) return false;
    this.byId.set(clean.id, clean);
    return true;
  }
}
