import { describe, expect, it } from 'vitest';
import { blueprintProblems, resolveBlueprint } from '../../../src/content/builds';
import { BUILD_MAX_BLOCKS, PLAY_MODES, SHAPES } from '../../../src/content/constants';
import type { BuildJson, PackJson } from '../../../src/content/raw-types';
import { readContentFromDisk } from '../../../src/content/validate/disk';
import { validateBundle } from '../../../src/content/validate/index';
import { SCHEMAS, validateSchema } from '../../../src/content/validate/schema';
import { evaluateBlueprint } from '../../../src/learning/blueprint';
import { lookupFromCells } from '../../../src/learning/grid';
import { BROKEN_ROOT, REPO_ROOT } from './helpers';

const shipped = readContentFromDisk(REPO_ROOT);
const builds = (shipped.bundle.builds ?? []).map((b) => b.data as BuildJson);
const parts = shipped.bundle.packs.find((p) => p.expectedId === 'parts')?.data as PackJson;
const knownKeys = new Set(shipped.bundle.packs.flatMap((p) => (p.data as PackJson).blocks.map((b) => `${(p.data as PackJson).id}:${b.id}`)));

describe('parts pack', () => {
  it('is big-mode only and every block has a valid shape', () => {
    expect(parts.mode).toBe('big');
    expect(validateSchema('pack', 'packs/parts/pack.json', parts)).toEqual([]);
    for (const b of parts.blocks) expect(SHAPES).toContain(b.shape ?? 'cube');
  });

  it('ships the promised pieces', () => {
    const count = (shape: string) => parts.blocks.filter((b) => b.shape === shape).length;
    expect(count('wheel')).toBeGreaterThanOrEqual(1);
    expect(count('slope')).toBe(3);
    expect(count('slab') + count('plate')).toBeGreaterThanOrEqual(4);
    expect(count('cone')).toBeGreaterThanOrEqual(1);
    expect(count('arch')).toBeGreaterThanOrEqual(1);
    expect(count('pane')).toBeGreaterThanOrEqual(4);
    expect(count('cylinder')).toBeGreaterThanOrEqual(1);
    const ids = parts.blocks.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['steering', 'flag']));
    expect(parts.blocks.every((b) => b.name.length > 0)).toBe(true);
  });

  it('schema enums match the code', () => {
    expect([...SCHEMAS.pack.definitions.shape.enum].sort()).toEqual([...SHAPES].sort());
    expect([...SCHEMAS.pack.properties.mode.enum].sort()).toEqual([...PLAY_MODES].sort());
    expect([...SCHEMAS.card.properties.mode.enum].sort()).toEqual([...PLAY_MODES].sort());
  });
});

describe('shipped builds', () => {
  it('has at least ten builds spread over difficulty 1 to 3', () => {
    expect(builds.length).toBeGreaterThanOrEqual(10);
    for (const d of [1, 2, 3]) expect(builds.filter((b) => b.difficulty === d).length).toBeGreaterThanOrEqual(3);
    const ids = builds.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['house', 'truck', 'car', 'rocket', 'boat', 'castle-tower', 'tree-house', 'bridge', 'robot']));
    expect(ids.some((id) => id === 'train' || id === 'fire-station')).toBe(true);
  });

  it.each(builds.map((b) => [b.id, b] as const))('%s is valid, small-stepped and bottom-up', (id, b) => {
    expect(validateSchema('build', `builds/${id}.json`, b)).toEqual([]);
    expect(blueprintProblems(b)).toEqual([]);
    const keys = b.steps.flatMap((s) => s.blocks.map((x) => x.block));
    expect(keys.filter((k) => !knownKeys.has(k))).toEqual([]);
    expect(keys.length).toBeLessThanOrEqual(BUILD_MAX_BLOCKS);
    const maxStep = b.difficulty === 1 ? 4 : b.difficulty === 2 ? 6 : 8;
    for (const s of b.steps) expect(s.blocks.length).toBeLessThanOrEqual(maxStep);
    // Steps never go back down: each step's lowest block is not below the previous step's lowest.
    const lows = b.steps.map((s) => Math.min(...s.blocks.map((x) => x.y)));
    lows.forEach((low, i) => expect(low).toBeGreaterThanOrEqual(i === 0 ? 0 : Math.min(...lows.slice(0, i))));
  });

  it('vehicles put their wheels down first and builds use parts', () => {
    for (const id of ['car', 'truck', 'train']) {
      const b = builds.find((x) => x.id === id)!;
      expect(b.steps[0].blocks.every((x) => x.block.includes('wheel'))).toBe(true);
    }
    const usingParts = builds.filter((b) => b.steps.some((s) => s.blocks.some((x) => x.block.startsWith('parts:'))));
    expect(usingParts.length).toBeGreaterThanOrEqual(8);
  });

  it('can be completed step by step', () => {
    for (const json of builds) {
      const bp = resolveBlueprint(json);
      const placed: { x: number; y: number; z: number; block: string }[] = [];
      bp.steps.forEach((step, i) => {
        expect(evaluateBlueprint(bp, { x: 0, y: 0, z: 0 }, lookupFromCells(placed)).stepIndex).toBe(i);
        placed.push(...step.blocks);
      });
      expect(evaluateBlueprint(bp, { x: 0, y: 0, z: 0 }, lookupFromCells(placed)).done).toBe(true);
    }
  });

  it('whole shipped content validates', () => {
    expect(validateBundle(shipped.bundle, shipped.exists)).toEqual([]);
  });
});

describe('blueprintProblems', () => {
  const step = (...blocks: [number, number, number][]) => ({ blocks: blocks.map(([x, y, z]) => ({ x, y, z, block: 'colors:red' })) });

  it('accepts blocks resting on the ground, on earlier blocks or beside them', () => {
    expect(blueprintProblems({ steps: [step([0, 0, 0]), step([0, 1, 0], [1, 1, 0], [2, 1, 0])] })).toEqual([]);
  });

  it('rejects floating blocks, duplicates, empty steps, oversize and no ground contact', () => {
    expect(blueprintProblems({ steps: [step([0, 0, 0]), step([3, 2, 3])] }).join()).toMatch(/floats/);
    expect(blueprintProblems({ steps: [step([0, 0, 0], [0, 0, 0])] }).join()).toMatch(/used twice/);
    expect(blueprintProblems({ steps: [step([0, 0, 0]), { blocks: [] }] }).join()).toMatch(/step 2 has no blocks/);
    expect(blueprintProblems({ steps: [step(...Array.from({ length: 9 }, (_, x) => [x, 0, 0] as [number, number, number]))] }).join()).toMatch(/9 cells along x/);
    const many = Array.from({ length: 81 }, (_, i) => [i % 9, Math.floor(i / 81), Math.floor(i / 9)] as [number, number, number]);
    expect(blueprintProblems({ steps: [step(...many)] }).join()).toMatch(/81 blocks; the limit is 80/);
    expect(blueprintProblems({ steps: [{ blocks: [{ x: 0, y: 1, z: 0, block: 'a:b' }] }] }).join()).toMatch(/no block touches the ground/);
  });
});

describe('broken builds fixture', () => {
  const disk = readContentFromDisk(BROKEN_ROOT);
  const issues = validateBundle(disk.bundle, disk.exists);
  const forFile = (file: string) => issues.filter((i) => i.file === file).map((i) => i.message).join('\n');

  it('reports schema problems', () => {
    const out = forFile('builds/bad-schema.json');
    expect(out).toContain('/difficulty');
    expect(out).toContain('/steps/0/blocks');
    expect(out).toContain('/steps/1/blocks/0/x');
    expect(out).toContain('/steps/1/blocks/0/rot');
    expect(out).toContain('unknown property "wobble"');
  });

  it('reports cross-reference and structure problems', () => {
    const out = forFile('builds/floating.json');
    expect(out).toContain('build uses unknown block "nope:missing"');
    expect(out).toMatch(/cell \(0,0,0\) is used twice/);
    expect(out).toMatch(/step 2: block at \(3,2,3\) floats/);
    expect(forFile('builds/renamed.json')).toContain('build id "other-build" must match its name "renamed"');
  });
});
