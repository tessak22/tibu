/**
 * npm run validate: checks every pack, theme and card against its JSON Schema
 * and cross-checks references. Exits 1 with readable messages on problems.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readContentFromDisk } from '../src/content/validate/disk';
import { validateBundle } from '../src/content/validate/index';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { bundle, exists, readIssues } = readContentFromDisk(root);
const issues = [...readIssues, ...validateBundle(bundle, exists)];

const blockCount = bundle.packs.reduce((n, p) => {
  const blocks = (p.data as { blocks?: unknown[] }).blocks;
  return n + (Array.isArray(blocks) ? blocks.length : 0);
}, 0);

if (issues.length > 0) {
  console.error(`\nContent validation failed with ${issues.length} problem(s):\n`);
  const byFile = new Map<string, string[]>();
  for (const { file, message } of issues) byFile.set(file, [...(byFile.get(file) ?? []), message]);
  for (const [file, messages] of byFile) {
    console.error(`  ${file}`);
    for (const m of messages) console.error(`    - ${m}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `Content OK: ${bundle.packs.length} packs (${blockCount} blocks), ` +
    `${bundle.themes.length} themes, ${bundle.cards.length} cards.`,
);
