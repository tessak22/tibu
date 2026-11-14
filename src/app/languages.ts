import LINES from '../../voice/LINES.json';
import type { LanguageOption } from '../ui/parent/types';

/** Reads the language list from voice/LINES.json ({ languages: { code: { name } } }). */
export function languagesFrom(lines: unknown): LanguageOption[] {
  const langs = lines && typeof lines === 'object' ? (lines as { languages?: unknown }).languages : undefined;
  if (!langs || typeof langs !== 'object') return [{ code: 'en', name: 'English' }];
  const out = Object.entries(langs as Record<string, unknown>).map(([code, info]) => {
    const name = info && typeof info === 'object' ? (info as { name?: unknown }).name : undefined;
    return { code, name: typeof name === 'string' && name ? name : code };
  });
  return out.length > 0 ? out : [{ code: 'en', name: 'English' }];
}

export const LANGUAGES: readonly LanguageOption[] = languagesFrom(LINES);
