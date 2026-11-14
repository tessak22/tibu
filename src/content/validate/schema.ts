/** JSON Schema validation with Ajv. Node / build-time only (not imported by the runtime loader). */
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import packSchema from '../../../schemas/pack.schema.json';
import themeSchema from '../../../schemas/theme.schema.json';
import cardSchema from '../../../schemas/card.schema.json';
import buildSchema from '../../../schemas/build.schema.json';
import type { ValidationIssue } from './types';

export type ContentKind = 'pack' | 'theme' | 'card' | 'build';

export const SCHEMAS = { pack: packSchema, theme: themeSchema, card: cardSchema, build: buildSchema } as const;

let compiled: Record<ContentKind, ValidateFunction> | null = null;

function validators(): Record<ContentKind, ValidateFunction> {
  if (compiled) return compiled;
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
  compiled = {
    pack: ajv.compile(packSchema),
    theme: ajv.compile(themeSchema),
    card: ajv.compile(cardSchema),
    build: ajv.compile(buildSchema),
  };
  return compiled;
}

function describe(error: ErrorObject): string {
  const where = error.instancePath === '' ? '(root)' : error.instancePath;
  const params = error.params as Record<string, unknown>;
  if (error.keyword === 'additionalProperties') {
    return `${where}: unknown property "${String(params.additionalProperty)}"`;
  }
  if (error.keyword === 'enum') {
    const allowed = (params.allowedValues as unknown[]).join(', ');
    return `${where}: must be one of: ${allowed}`;
  }
  return `${where}: ${error.message ?? 'is invalid'}`;
}

/**
 * Turns Ajv errors into readable lines. oneOf branches produce noise for the
 * branches that were not meant, so drop the generic "must match exactly one"
 * line when more specific errors exist and remove duplicates.
 */
function summarize(errors: readonly ErrorObject[]): string[] {
  const specific = errors.filter((e) => e.keyword !== 'oneOf' && e.keyword !== 'if');
  const chosen = specific.length > 0 ? specific : errors;
  return [...new Set(chosen.map(describe))];
}

/** Validates one document against its schema. Returns [] when valid. */
export function validateSchema(kind: ContentKind, file: string, data: unknown): ValidationIssue[] {
  const validate = validators()[kind];
  if (validate(data)) return [];
  return summarize(validate.errors ?? []).map((message) => ({ file, message: `schema: ${message}` }));
}
