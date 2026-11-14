/** Voice line ids, shared with voice/LINES.json. Pure. */
export const blockVoiceLine = (packId: string, blockId: string): string => `block.${packId}.${blockId}`;
export const packVoiceLine = (packId: string): string => `pack.${packId}`;
export const themeVoiceLine = (themeId: string): string => `theme.${themeId}`;
export const cardVoiceLine = (cardId: string): string => `card.${cardId}`;
export const PLACEHOLDER_VOICE_LINE = 'block.placeholder';
/** Spoken name of a blueprint, e.g. "house". */
export const blueprintVoiceLine = (buildId: string): string => `build.${buildId}`;
/** "You built a house!" */
export const builtVoiceLine = (buildId: string): string => `built.${buildId}`;
