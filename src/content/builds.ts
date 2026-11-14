/**
 * Blueprint (builds/<id>.json) resolution and structural checks. Pure (no canvas),
 * shared by the runtime loader, the validator and tests.
 */
import type { Blueprint } from '../core/types';
import { BUILD_MAX_BLOCKS, BUILD_MAX_SIZE } from './constants';
import type { BuildBlockJson, BuildJson } from './raw-types';
import { blueprintVoiceLine } from './voice-lines';

const cellKey = (c: { x: number; y: number; z: number }): string => `${c.x},${c.y},${c.z}`;

/** Horizontal neighbours plus the cell below: what a block may rest on or lean against. */
const SUPPORT_OFFSETS: readonly (readonly [number, number, number])[] = [
  [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
];

function isSupported(b: BuildBlockJson, placed: ReadonlySet<string>): boolean {
  if (b.y === 0) return true;
  return SUPPORT_OFFSETS.some(([dx, dy, dz]) => placed.has(cellKey({ x: b.x + dx, y: b.y + dy, z: b.z + dz })));
}

/**
 * Blocks of one step that do not rest on the ground, on an earlier block, or on
 * (or beside) another supported block of the same step.
 */
function unsupportedInStep(step: readonly BuildBlockJson[], placed: Set<string>): BuildBlockJson[] {
  let pending = [...step];
  let progress = true;
  while (pending.length > 0 && progress) {
    const next = pending.filter((b) => !isSupported(b, placed));
    progress = next.length < pending.length;
    for (const b of pending) if (!next.includes(b)) placed.add(cellKey(b));
    pending = next;
  }
  for (const b of pending) placed.add(cellKey(b));
  return pending;
}

/** Structural problems with a blueprint's steps (empty when it is fine). Block keys are checked elsewhere. */
export function blueprintProblems(json: Pick<BuildJson, 'steps'>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const placed = new Set<string>();
  const all: BuildBlockJson[] = [];
  json.steps.forEach((step, i) => {
    const where = `step ${i + 1}`;
    if (!step.blocks || step.blocks.length === 0) {
      problems.push(`${where} has no blocks`);
      return;
    }
    for (const b of step.blocks) {
      const k = cellKey(b);
      if (seen.has(k)) problems.push(`${where}: cell (${k}) is used twice`);
      seen.add(k);
      all.push(b);
    }
    for (const b of unsupportedInStep(step.blocks, placed)) {
      problems.push(`${where}: block at (${cellKey(b)}) floats; it must rest on the ground or touch an earlier block`);
    }
  });
  if (all.length > BUILD_MAX_BLOCKS) problems.push(`has ${all.length} blocks; the limit is ${BUILD_MAX_BLOCKS}`);
  for (const axis of ['x', 'y', 'z'] as const) {
    const values = all.map((b) => b[axis]);
    if (values.length === 0) continue;
    const span = Math.max(...values) - Math.min(...values) + 1;
    if (span > BUILD_MAX_SIZE || Math.min(...values) < 0) {
      problems.push(`is ${span} cells along ${axis}; builds must fit in ${BUILD_MAX_SIZE}x${BUILD_MAX_SIZE}x${BUILD_MAX_SIZE} starting at 0`);
    }
  }
  if (all.length > 0 && !all.some((b) => b.y === 0)) problems.push('no block touches the ground (y=0)');
  return problems;
}

/** Turns schema-valid JSON into a Blueprint. */
export function resolveBlueprint(json: BuildJson): Blueprint {
  return {
    id: json.id,
    name: json.name,
    voiceLine: blueprintVoiceLine(json.id),
    difficulty: json.difficulty,
    steps: json.steps.map((s) => ({
      blocks: s.blocks.map((b) => ({ x: b.x, y: b.y, z: b.z, block: b.block, ...(b.rot ? { rot: b.rot } : {}) })),
    })),
  };
}

/** Every block key a blueprint uses. */
export function blueprintKeys(json: Pick<BuildJson, 'steps'>): string[] {
  return [...new Set(json.steps.flatMap((s) => (s.blocks ?? []).map((b) => b.block)))];
}
