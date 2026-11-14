/**
 * voice/LINES.json format and lookups (pure, no DOM).
 *
 * {
 *   "languages": { "en": { "name": "English", "speechLang": "en-US",
 *                          "kokoro": { "langCode": "a", "voice": "af_heart", "speed": 0.9 } } },
 *   "lines": { "<lineId>": { "en": "text", "fr": "texte" } }
 * }
 */

export interface KokoroLanguageConfig {
  readonly langCode: string;
  readonly voice: string;
  readonly speed?: number;
}

export interface LanguageMeta {
  readonly name: string;
  /** BCP-47 tag for speechSynthesis fallback, e.g. "en-US". */
  readonly speechLang: string;
  readonly kokoro?: KokoroLanguageConfig;
}

export interface LinesFile {
  readonly $comment?: string;
  readonly languages: Readonly<Record<string, LanguageMeta>>;
  readonly lines: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export const DEFAULT_LANGUAGE = 'en';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates untrusted JSON into a LinesFile, dropping malformed entries. */
export function parseLinesFile(raw: unknown): LinesFile {
  const root = isRecord(raw) ? raw : {};
  const languages: Record<string, LanguageMeta> = {};
  if (isRecord(root.languages)) {
    for (const [code, meta] of Object.entries(root.languages)) {
      if (!isRecord(meta)) continue;
      const name = typeof meta.name === 'string' ? meta.name : code;
      const speechLang = typeof meta.speechLang === 'string' ? meta.speechLang : code;
      const kokoro = isRecord(meta.kokoro) ? (meta.kokoro as unknown as KokoroLanguageConfig) : undefined;
      languages[code] = kokoro ? { name, speechLang, kokoro } : { name, speechLang };
    }
  }
  const lines: Record<string, Record<string, string>> = {};
  if (isRecord(root.lines)) {
    for (const [id, entry] of Object.entries(root.lines)) {
      if (!isRecord(entry)) continue;
      const texts: Record<string, string> = {};
      for (const [lang, text] of Object.entries(entry)) {
        if (typeof text === 'string' && text.trim()) texts[lang] = text;
      }
      lines[id] = texts;
    }
  }
  return {
    ...(typeof root.$comment === 'string' ? { $comment: root.$comment } : {}),
    languages,
    lines,
  };
}

/** Text of a line in `lang`, or null. */
export function lineText(file: LinesFile, lineId: string, lang: string): string | null {
  return file.lines[lineId]?.[lang] ?? null;
}

export function hasLine(file: LinesFile, lineId: string): boolean {
  return Object.prototype.hasOwnProperty.call(file.lines, lineId);
}

/** speechSynthesis language tag for a language code. */
export function speechLangFor(file: LinesFile, lang: string): string {
  return file.languages[lang]?.speechLang ?? lang;
}
