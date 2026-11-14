/**
 * Cross-reference checks that JSON Schema cannot express. Pure: works on
 * already schema-valid data plus a file-existence callback.
 */
import { WORLD_SIZE } from '../../core/types';
import { boxVolume, expandCells, isBox } from '../cells';
import { MAX_BOX_CELLS, SCENE_MAX_RADIUS } from '../constants';
import type { ArtSpec, BlockJson, PackJson, SceneEntry, ThemeJson } from '../raw-types';
import type { FileExists, SourceFile, TypedBundle, ValidationIssue } from './types';

type Report = (file: string, message: string) => void;

function folderOf(file: string): string {
  return file.slice(0, file.lastIndexOf('/') + 1);
}

function checkPath(report: Report, file: string, rel: string, exists: FileExists): void {
  if (rel.split('/').includes('..') || rel.startsWith('/')) {
    report(file, `path "${rel}" must stay inside its folder`);
    return;
  }
  const full = folderOf(file) + rel;
  if (!exists(full)) report(file, `missing file "${full}"`);
}

function artsOf(block: BlockJson): ArtSpec[] {
  const faces = block.faces ?? {};
  return [block.art, faces.top, faces.side, faces.bottom].filter((a): a is ArtSpec => a !== undefined);
}

function checkBlock(report: Report, file: string, block: BlockJson, exists: FileExists): void {
  const where = `block "${block.id}"`;
  for (const art of artsOf(block)) {
    if ('image' in art) checkPath(report, file, art.image, exists);
  }
  if (block.sound && 'file' in block.sound) checkPath(report, file, block.sound.file, exists);
  const behaviors = block.behaviors ?? [];
  if (behaviors.includes('sound') && !block.sound) {
    report(file, `${where} has the "sound" behavior but no sound`);
  }
  if (block.glowColor && !behaviors.includes('glow')) {
    report(file, `${where} has a glowColor but not the "glow" behavior`);
  }
}

function checkPack(report: Report, src: SourceFile<PackJson>, exists: FileExists): void {
  const { file, data } = src;
  const seen = new Set<string>();
  for (const block of data.blocks) {
    if (seen.has(block.id)) report(file, `duplicate block id "${block.id}"`);
    seen.add(block.id);
    checkBlock(report, file, block, exists);
  }
  const icon = data.icon;
  if (icon && 'block' in icon && !seen.has(icon.block)) {
    report(file, `icon refers to unknown block "${icon.block}"`);
  }
  if (icon && 'image' in icon) checkPath(report, file, icon.image, exists);
}

function checkIds(report: Report, sources: readonly SourceFile<{ id: string }>[], kind: string): void {
  const seen = new Set<string>();
  for (const { file, data, expectedId } of sources) {
    if (data.id !== expectedId) report(file, `${kind} id "${data.id}" must match its name "${expectedId}"`);
    if (seen.has(data.id)) report(file, `duplicate ${kind} id "${data.id}"`);
    seen.add(data.id);
  }
}

function checkKeys(report: Report, file: string, keys: readonly string[], known: ReadonlySet<string>, what: string): void {
  for (const key of new Set(keys)) {
    if (!known.has(key)) report(file, `${what} uses unknown block "${key}"`);
  }
}

function checkBoxes(report: Report, file: string, entries: readonly SceneEntry[]): void {
  for (const e of entries) {
    if (isBox(e) && boxVolume(e) > MAX_BOX_CELLS) {
      report(file, `box from [${e.from.join(',')}] to [${e.to.join(',')}] covers more than ${MAX_BOX_CELLS} cells`);
    }
  }
}

function checkTheme(report: Report, src: SourceFile<ThemeJson>, known: ReadonlySet<string>, exists: FileExists): void {
  const { file, data } = src;
  checkKeys(report, file, data.ground, known, 'ground');
  checkKeys(report, file, data.scene.map((e) => e.block), known, 'scene');
  if (data.icon) checkPath(report, file, data.icon, exists);
  checkBoxes(report, file, data.scene);
  const floor = data.ground.length;
  const cx = (WORLD_SIZE.x - 1) / 2;
  const cz = (WORLD_SIZE.z - 1) / 2;
  for (const c of expandCells(data.scene)) {
    const at = `scene cell (${c.x},${c.y},${c.z})`;
    if (c.y < floor) report(file, `${at} is inside the ground; the scene starts at y=${floor}`);
    if (c.y >= WORLD_SIZE.y) report(file, `${at} is above the world (max y=${WORLD_SIZE.y - 1})`);
    if (Math.hypot(c.x - cx, c.z - cz) > SCENE_MAX_RADIUS) {
      report(file, `${at} is too close to the island edge (keep within ${SCENE_MAX_RADIUS} of the center)`);
    }
  }
}

/** Runs every cross-reference check on schema-valid content. */
export function checkCrossRefs(bundle: TypedBundle, exists: FileExists): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report: Report = (file, message) => issues.push({ file, message });

  checkIds(report, bundle.packs, 'pack');
  checkIds(report, bundle.themes, 'theme');
  checkIds(report, bundle.cards, 'card');

  const known = new Set<string>();
  for (const pack of bundle.packs) {
    checkPack(report, pack, exists);
    for (const block of pack.data.blocks) known.add(`${pack.data.id}:${block.id}`);
  }
  for (const theme of bundle.themes) checkTheme(report, theme, known, exists);
  for (const card of bundle.cards) {
    checkKeys(report, card.file, card.data.blocks.map((e) => e.block), known, 'card');
    checkBoxes(report, card.file, card.data.blocks);
  }
  return issues;
}
