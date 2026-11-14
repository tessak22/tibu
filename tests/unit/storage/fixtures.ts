import type { SavedWorld } from '../../../src/core/types';

export const sampleWorld = (extra: number = 0): SavedWorld => ({
  format: 'tibu-world',
  version: 1,
  themeId: 'meadow',
  palette: ['nature:grass', 'colors:red'],
  blocks: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    ...Array.from({ length: extra }, (_, i) => [2 + i, 1, 2, 1] as const),
  ],
});

let counter = 0;
export const uniqueDbName = (): string => `tibu-test-${Date.now()}-${counter++}`;
