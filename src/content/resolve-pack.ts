/** Turns pack.json data into ResolvedPack objects with generated art. Browser only. */
import type { BehaviorName, FaceName, ResolvedBlock, ResolvedPack, SoundRef } from '../core/types';
import { artColor, type ArtRenderer } from './art/face';
import { cubeIcon, packIcon } from './art/icons';
import { shapeIcon } from './art/shape-icon';
import { byOrder, isBlockLike } from './guards';
import type { ArtSpec, BlockJson, PackJson, SoundSpec } from './raw-types';
import { blockVoiceLine, packVoiceLine } from './voice-lines';

export interface ResolveEnv {
  readonly art: ArtRenderer;
  /** Repo-relative asset path to bundled URL. */
  readonly assets: ReadonlyMap<string, string>;
}

const DEFAULT_BEHAVIORS: readonly BehaviorName[] = ['speak'];
const DEFAULT_TILE = '#eef0f8';

function toSoundRef(spec: SoundSpec | undefined, folder: string, assets: ReadonlyMap<string, string>): SoundRef | undefined {
  if (!spec) return undefined;
  if ('synth' in spec) return spec.note === undefined ? { type: 'synth', preset: spec.synth } : { type: 'synth', preset: spec.synth, note: spec.note };
  const url = assets.get(folder + spec.file);
  return url ? { type: 'file', url } : undefined;
}

/** Main color of a block's top face (icons, theme pictures). */
export function blockSwatch(block: BlockJson): string {
  return artColor(block.faces?.top ?? block.art);
}

function resolveBlock(packId: string, folder: string, json: BlockJson, env: ResolveEnv): ResolvedBlock {
  const draw = (spec: ArtSpec | undefined): HTMLCanvasElement => env.art.render(spec ?? json.art, folder);
  const top = draw(json.faces?.top);
  const side = draw(json.faces?.side);
  const bottom = draw(json.faces?.bottom);
  const faces: Record<FaceName, HTMLCanvasElement> = { top, bottom, north: side, south: side, east: side, west: side };
  const behaviors = json.behaviors ?? DEFAULT_BEHAVIORS;
  const tapSound = toSoundRef(json.sound, folder, env.assets);
  const shape = json.shape ?? 'cube';
  const glowColor = behaviors.includes('glow') ? (json.glowColor ?? artColor(json.art)) : undefined;
  return {
    key: `${packId}:${json.id}`,
    packId,
    id: json.id,
    name: json.name,
    voiceLine: blockVoiceLine(packId, json.id),
    faces,
    icon: shape === 'cube' ? cubeIcon(top, side, side) : shapeIcon(shape, faces),
    behaviors,
    shape,
    ...(tapSound ? { tapSound } : {}),
    ...(glowColor ? { glowColor } : {}),
  };
}

function showcaseIcon(json: PackJson, blocks: readonly ResolvedBlock[], env: ResolveEnv, folder: string): HTMLCanvasElement {
  const icon = json.icon;
  if (icon && 'block' in icon) {
    const found = blocks.find((b) => b.id === icon.block);
    if (found) return found.icon;
  } else if (icon) {
    const face = env.art.render(icon, folder);
    return cubeIcon(face, face, face);
  }
  return blocks[0].icon;
}

/** Resolves one pack. Malformed blocks are skipped; returns null if nothing usable remains. */
export function resolvePack(json: PackJson, env: ResolveEnv): ResolvedPack | null {
  const folder = `packs/${json.id}/`;
  const blocks = json.blocks.filter(isBlockLike).map((b) => resolveBlock(json.id, folder, b, env));
  if (blocks.length === 0) return null;
  return {
    id: json.id,
    name: json.name,
    voiceLine: packVoiceLine(json.id),
    icon: packIcon(showcaseIcon(json, blocks, env, folder), json.tileColor ?? DEFAULT_TILE),
    blocks,
    ...(json.mode ? { mode: json.mode } : {}),
  };
}

export const sortPacks = (packs: readonly PackJson[]): PackJson[] => [...packs].sort(byOrder);
