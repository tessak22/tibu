/** Full content validation: schemas first, then cross-references on the valid documents. */
import type { BuildJson, CardJson, PackJson, ThemeJson } from '../raw-types';
import { checkCrossRefs } from './crossref';
import { validateSchema, type ContentKind } from './schema';
import type { ContentBundle, FileExists, SourceFile, ValidationIssue } from './types';

export type { ContentBundle, FileExists, SourceFile, ValidationIssue } from './types';
export { validateSchema } from './schema';
export { checkCrossRefs } from './crossref';

function partition<T>(kind: ContentKind, sources: readonly SourceFile[], issues: ValidationIssue[]): SourceFile<T>[] {
  const valid: SourceFile<T>[] = [];
  for (const src of sources) {
    const found = validateSchema(kind, src.file, src.data);
    issues.push(...found);
    if (found.length === 0) valid.push(src as SourceFile<T>);
  }
  return valid;
}

export function validateBundle(bundle: ContentBundle, exists: FileExists): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const typed = {
    packs: partition<PackJson>('pack', bundle.packs, issues),
    themes: partition<ThemeJson>('theme', bundle.themes, issues),
    cards: partition<CardJson>('card', bundle.cards, issues),
    builds: partition<BuildJson>('build', bundle.builds ?? [], issues),
  };
  return [...issues, ...checkCrossRefs(typed, exists)];
}
