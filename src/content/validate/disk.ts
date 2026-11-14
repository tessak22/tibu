/** Reads content JSON from disk. Node only (scripts and tests). */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ContentBundle, FileExists, SourceFile, ValidationIssue } from './types';

export interface DiskContent {
  readonly bundle: ContentBundle;
  readonly exists: FileExists;
  /** Problems reading files (missing pack.json, bad JSON). */
  readonly readIssues: readonly ValidationIssue[];
}

function toRepoPath(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/');
}

function readJson(root: string, abs: string, expectedId: string, issues: ValidationIssue[]): SourceFile | null {
  const file = toRepoPath(root, abs);
  try {
    return { file, expectedId, data: JSON.parse(readFileSync(abs, 'utf8')) as unknown };
  } catch (err) {
    issues.push({ file, message: `cannot read JSON: ${(err as Error).message}` });
    return null;
  }
}

function subfolders(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && statSync(join(dir, name)).isDirectory())
    .sort();
}

function readFolders(root: string, dir: string, fileName: string, issues: ValidationIssue[]): SourceFile[] {
  const out: SourceFile[] = [];
  for (const name of subfolders(join(root, dir))) {
    const abs = join(root, dir, name, fileName);
    if (!existsSync(abs)) {
      issues.push({ file: `${dir}/${name}`, message: `folder has no ${fileName}` });
      continue;
    }
    const src = readJson(root, abs, name, issues);
    if (src) out.push(src);
  }
  return out;
}

function readFlat(root: string, folder: string, issues: ValidationIssue[]): SourceFile[] {
  const dir = join(root, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => readJson(root, join(dir, n), n.slice(0, -'.json'.length), issues))
    .filter((s): s is SourceFile => s !== null);
}

/** Loads packs/, themes/, cards/ and builds/ under `root` (the repo root). */
export function readContentFromDisk(root: string): DiskContent {
  const readIssues: ValidationIssue[] = [];
  const bundle: ContentBundle = {
    packs: readFolders(root, 'packs', 'pack.json', readIssues),
    themes: readFolders(root, 'themes', 'theme.json', readIssues),
    cards: readFlat(root, 'cards', readIssues),
    builds: readFlat(root, 'builds', readIssues),
  };
  const exists: FileExists = (repoPath) => existsSync(join(root, ...repoPath.split('/')));
  return { bundle, exists, readIssues };
}
