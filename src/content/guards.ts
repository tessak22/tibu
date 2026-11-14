/**
 * Light runtime shape guards. Full schema validation runs at build time
 * (npm run validate); these only keep a malformed file from crashing play.
 */
import type { CardJson, PackJson, ThemeJson } from './raw-types';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function isPackJson(v: unknown): v is PackJson {
  return isObject(v) && isString(v.id) && isString(v.name) && Array.isArray(v.blocks);
}

export function isThemeJson(v: unknown): v is ThemeJson {
  return (
    isObject(v) && isString(v.id) && isString(v.name) && isObject(v.sky) && isObject(v.island) &&
    Array.isArray(v.ground) && v.ground.length > 0 && Array.isArray(v.scene)
  );
}

export function isCardJson(v: unknown): v is CardJson {
  return isObject(v) && isString(v.id) && isString(v.name) && Array.isArray(v.blocks) && v.blocks.length > 0;
}

export function isBlockLike(v: unknown): boolean {
  return isObject(v) && isString(v.id) && isString(v.name) && isObject(v.art);
}

export function byOrder<T extends { readonly order?: number; readonly id: string }>(a: T, b: T): number {
  return (a.order ?? 1000) - (b.order ?? 1000) || a.id.localeCompare(b.id);
}
