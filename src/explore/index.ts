/**
 * Big-kid explore mode: a buddy you walk around by tapping, wandering animals, and treasure
 * chests with stickers. Everything is driven from view.onFrame; nothing here can fail or
 * strand the buddy.
 */
import * as THREE from 'three';
import type { AudioSystem, Cell, ContentRegistry, GameView, WorldModel } from '../core/types';
import { createAnimals } from './animals';
import { createCharacterController } from './characterController';
import { createChests } from './chestsController';
import { hashString } from './rng';
import { createSpace } from './space';
import type { CharacterVariant } from './three/characterMesh';
import { createEffects } from './three/effects';
import { acquireShared } from './three/shared';
import * as walk from './walkApi';

export { placeChests, chooseSticker } from './chests';
export { STICKERS, STICKER_IDS, GOLD_STAR, drawSticker, stickerDef, type StickerDef } from './stickers';
export { variantForAnimal, type CharacterVariant } from './three/characterMesh';

export interface ExplorerDeps {
  readonly view: GameView;
  readonly world: WorldModel;
  readonly registry: ContentRegistry;
  readonly audio: AudioSystem;
  readonly spawn: Cell;
  readonly animalSpots: readonly Cell[];
  readonly reducedMotion: () => boolean;
  readonly onStickerFound: (stickerId: string) => void;
  readonly isFound: (stickerId: string) => boolean;
  /** Optional buddy colour (see variantForAnimal). Defaults to mint. */
  readonly variant?: CharacterVariant;
}

export interface Explorer {
  walkTo(cell: Cell): void;
  character(): THREE.Object3D;
  characterCell(): Cell;
  recenter(): void;
  setFollowing(on: boolean): void;
  dispose(): void;
}

/**
 * Whether disposing an explorer should clear the view's follow target: only when the camera
 * still follows this explorer's buddy (views without followTarget() fall back to "if we set it").
 */
export function shouldReleaseFollow(
  view: Pick<GameView, 'followTarget'>,
  mine: THREE.Object3D,
  following: boolean,
): boolean {
  if (typeof view.followTarget === 'function') return view.followTarget() === mine;
  return following;
}

const GIGGLE_NOTES = [76, 81, 84] as const;

export function createExplorer(deps: ExplorerDeps): Explorer {
  const { view, world, audio } = deps;
  const releaseShared = acquireShared();
  const space = createSpace(view);
  const effects = createEffects(deps.reducedMotion);
  const removeEffects = view.addActor(effects.root);
  const tmp = new THREE.Vector3();
  let giggleQueue = 0;
  let giggleIn = 0;
  let disposed = false;
  let following = false;

  // Chests reference the character (and vice versa) through these late-bound functions.
  let charCell = (): Cell => deps.spawn;
  let walkToCell = (_cell: Cell): void => undefined;

  const chests = createChests({
    world,
    view,
    audio,
    space,
    effects,
    reducedMotion: deps.reducedMotion,
    characterCell: () => charCell(),
    walkTo: (cell) => walkToCell(cell),
    celebrate: () => character.gesture('happy'),
    onStickerFound: deps.onStickerFound,
    isFound: deps.isFound,
  });

  const character = createCharacterController({
    world,
    walk,
    space,
    spawn: deps.spawn,
    reducedMotion: deps.reducedMotion,
    variant: deps.variant,
    hooks: {
      onHop: () => audio.play({ type: 'synth', preset: 'pop' }),
      onArrive: (cell) => chests.arrivedAt(cell),
      onShrug: () => audio.play({ type: 'synth', preset: 'chime', note: 67 }),
    },
  });
  charCell = () => character.cell();

  function walkTo(cell: Cell): void {
    if (disposed) return;
    space.feet(cell.x, cell.y, cell.z, tmp);
    effects.marker(tmp.x, tmp.y, tmp.z);
    audio.sfx('tap');
    character.walkTo(cell);
  }
  walkToCell = walkTo;

  const removeCharacter = view.addActor(character.rig.root, {
    onTap: () => {
      character.gesture('giggle');
      giggleQueue = GIGGLE_NOTES.length;
      giggleIn = 0;
    },
  });

  const animals = createAnimals({
    world,
    walk,
    space,
    registry: deps.registry,
    audio,
    spots: deps.animalSpots,
    seed: hashString(`${deps.spawn.x},${deps.spawn.z},${deps.animalSpots.length}`),
    reducedMotion: deps.reducedMotion,
    addActor: (obj, onTap) => view.addActor(obj, { onTap }),
    characterCell: () => character.cell(),
  });

  const offChange = world.onChange(() => {
    character.markDirty();
    animals.markDirty();
  });

  const offFrame = view.onFrame((dt) => {
    if (giggleQueue > 0) {
      giggleIn -= dt;
      if (giggleIn <= 0) {
        const note = GIGGLE_NOTES[GIGGLE_NOTES.length - giggleQueue] as number;
        audio.play({ type: 'synth', preset: 'chime', note });
        giggleQueue -= 1;
        giggleIn = 0.11;
      }
    }
    // Every update runs every frame; the view stays at full rate only while something moves.
    const walking = character.update(dt);
    const strolling = animals.update(dt);
    const opening = chests.update(dt);
    const sparkling = effects.update(dt);
    return walking || strolling || opening || sparkling || giggleQueue > 0;
  });

  return {
    walkTo,
    character: () => character.rig.root,
    characterCell: () => character.cell(),
    recenter() {
      if (disposed) return;
      const from = character.rig.root.position;
      effects.burst(from.x, from.y + 0.4, from.z, 0.7);
      character.teleport(deps.spawn);
      const c = character.cell();
      space.feet(c.x, c.y, c.z, tmp);
      effects.burst(tmp.x, tmp.y + 0.4, tmp.z, 1);
      audio.sfx('whoosh');
    },
    setFollowing(on) {
      if (disposed) return;
      following = on;
      view.setFollowTarget(on ? character.rig.root : null);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offFrame();
      offChange();
      // A newer explorer may already own the camera: only let go of our own buddy.
      if (shouldReleaseFollow(view, character.rig.root, following)) view.setFollowTarget(null);
      animals.dispose();
      chests.dispose();
      removeCharacter();
      effects.dispose();
      removeEffects();
      releaseShared();
    },
  };
}
