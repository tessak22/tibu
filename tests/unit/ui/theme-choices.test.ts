import { describe, expect, it } from 'vitest';
import { themeChoices, worldKindsFor } from '../../../src/ui/theme-picker';
import type { ThemeDef } from '../../../src/core/types';

const theme = (id: string): ThemeDef => ({ id }) as unknown as ThemeDef;

describe('theme picker world kinds', () => {
  it('little mode: islands only', () => {
    expect(worldKindsFor('little')).toEqual(['island']);
    expect(themeChoices([theme('a'), theme('b')], 'little').map((c) => c.kind)).toEqual(['island', 'island']);
  });
  it('big mode: every theme twice, islands first', () => {
    const choices = themeChoices([theme('a'), theme('b')], 'big');
    expect(choices.map((c) => `${c.theme.id}:${c.kind}`)).toEqual(['a:island', 'b:island', 'a:explore', 'b:explore']);
  });
});
