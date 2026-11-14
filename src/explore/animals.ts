/**
 * Wandering animals. Each one rests, then strolls to a nearby spot within its home range;
 * sometimes it trots a few steps toward the explorer when the explorer is close.
 * Tapping one plays its sound, bounces it and says its name.
 */
import * as THREE from 'three';
import type { AudioSystem, Cell, ContentRegistry, WorldModel } from '../core/types';
import {
  advanceFollower,
  createFollower,
  createPose,
  facing,
  followerDone,
  followerTarget,
  stepPose,
  turnToward,
  type Follower,
  type Pose,
  type StepTiming,
} from './follower';
import { createRng, randInt, type Rng } from './rng';
import { nearestStandable, planRoute, type WalkFns } from './route';
import type { Space } from './space';
import { buildAnimal, type AnimalRig } from './three/animalMesh';
import { clampRoute, pickWanderTarget, restTime } from './wander';

/** Keeps the iPad at 60 fps: at most this many animals. */
export const MAX_ANIMALS = 8;
export const MIN_ANIMALS = 6;
const HOME_RADIUS = 4;
const FOLLOW_RANGE = 4;
const FOLLOW_STEPS = 3;
const ANIMAL_STEPS: StepTiming = { flat: 0.7, climb: 0.9 };
const BOUNCE_TIME = 0.6;

export const ANIMAL_KINDS = [
  'cow',
  'pig',
  'sheep',
  'horse',
  'chicken',
  'duck',
  'cat',
  'dog',
  'bunny',
  'frog',
  'mouse',
  'bird',
] as const;

interface Animal {
  readonly kind: string;
  readonly rig: AnimalRig;
  readonly home: Cell;
  readonly rng: Rng;
  readonly pose: Pose;
  cell: Cell;
  follower: Follower | null;
  rest: number;
  yawTarget: number;
  bounce: number;
  phase: number;
  remove: () => void;
}

export interface AnimalsDeps {
  readonly world: WorldModel;
  readonly walk: WalkFns;
  readonly space: Space;
  readonly registry: ContentRegistry;
  readonly audio: AudioSystem;
  readonly spots: readonly Cell[];
  readonly seed: number;
  readonly reducedMotion: () => boolean;
  readonly addActor: (obj: THREE.Object3D, onTap: () => void) => () => void;
  readonly characterCell: () => Cell;
}

export interface AnimalsController {
  update(dt: number): void;
  markDirty(): void;
  count(): number;
  dispose(): void;
}

/** How many animals to spawn for a number of spots (6..10 wanted, capped by the budget). */
export function animalCount(spots: number): number {
  if (spots <= 0) return 0;
  return Math.min(MAX_ANIMALS, Math.max(MIN_ANIMALS, spots));
}

export function createAnimals(deps: AnimalsDeps): AnimalsController {
  const { world, walk, space } = deps;
  const isStandable = (c: Cell): boolean => walk.standable(world, c);
  const animals: Animal[] = [];
  const tmp = new THREE.Vector3();
  let dirty = false;
  const n = animalCount(deps.spots.length);
  const seedRng = createRng(deps.seed);
  const offset = randInt(seedRng, ANIMAL_KINDS.length);

  for (let i = 0; i < n; i++) {
    const spot = deps.spots[i % deps.spots.length] as Cell;
    const kind = ANIMAL_KINDS[(offset + i) % ANIMAL_KINDS.length] as string;
    const block = deps.registry.block(`animals:${kind}`);
    const fur = sampleColor(block.faces.bottom);
    const rig = buildAnimal(kind, block.faces.south, fur);
    const home = nearestStandable(isStandable, spot, 4, world.size.y, spot);
    const animal: Animal = {
      kind,
      rig,
      home,
      rng: createRng(deps.seed + i * 7919),
      pose: createPose(home),
      cell: home,
      follower: null,
      rest: 1 + i * 0.7,
      yawTarget: seedRng() * Math.PI * 2,
      bounce: 0,
      phase: seedRng() * 10,
      remove: () => undefined,
    };
    animal.pose.yaw = animal.yawTarget;
    animal.remove = deps.addActor(rig.root, () => tap(animal));
    animals.push(animal);
  }

  function tap(a: Animal): void {
    a.bounce = BOUNCE_TIME;
    const block = deps.registry.block(`animals:${a.kind}`);
    if (block.tapSound) deps.audio.play(block.tapSound);
    else deps.audio.sfx('tap');
    void deps.audio.speak(`block.animals.${a.kind}`, block.name);
    // Look at the explorer: a friendly hello.
    a.yawTarget = facing(a.cell, deps.characterCell(), a.yawTarget);
  }

  function chooseRoute(a: Animal): void {
    const me = deps.characterCell();
    const near = Math.abs(me.x - a.cell.x) <= FOLLOW_RANGE && Math.abs(me.z - a.cell.z) <= FOLLOW_RANGE;
    if (near && a.rng() < 0.4) {
      const route = planRoute(walk, world, a.cell, me, 300);
      const steps = route.steps.slice(0, Math.max(0, Math.min(FOLLOW_STEPS, route.steps.length - 1)));
      const kept = clampRoute(steps, a.home, HOME_RADIUS + FOLLOW_STEPS);
      if (kept.length > 0) {
        a.follower = createFollower(a.cell, kept);
        return;
      }
    }
    const target = pickWanderTarget(a.rng, a.home, HOME_RADIUS, isStandable);
    if (!target) return;
    const route = planRoute(walk, world, a.cell, target, 200);
    const kept = clampRoute(route.steps, a.home, HOME_RADIUS);
    if (kept.length > 0) a.follower = createFollower(a.cell, kept);
  }

  function step(a: Animal, dt: number): void {
    const f = a.follower;
    if (!f) return;
    const target = followerTarget(f);
    if (!target || !isStandable(target)) {
      a.follower = null;
      return;
    }
    const before = f.from;
    advanceFollower(f, dt, ANIMAL_STEPS);
    const arrived = f.from !== before;
    stepPose(before, target, arrived ? 1 : f.t, 0.25, a.pose);
    a.yawTarget = facing(before, target, a.yawTarget);
    if (arrived) {
      a.cell = target;
      if (followerDone(f)) {
        a.follower = null;
        a.rest = restTime(a.rng);
      }
    }
  }

  function animate(a: Animal, dt: number, rm: boolean): void {
    a.phase += dt;
    a.pose.yaw = turnToward(a.pose.yaw, a.yawTarget, 6, dt);
    const walking = a.follower !== null;
    let lift = walking ? Math.abs(Math.sin(a.phase * 9)) * (rm ? 0.01 : 0.04) : 0;
    let sy = 1 + Math.sin(a.phase * 2) * 0.015;
    if (a.bounce > 0) {
      a.bounce -= dt;
      const k = 1 - Math.max(0, a.bounce) / BOUNCE_TIME;
      lift += Math.sin(k * Math.PI) * (rm ? 0.12 : 0.35);
      sy *= 1 + Math.sin(k * Math.PI * 2) * 0.12;
    }
    const s = a.rig.size;
    a.rig.squash.scale.set(s * (2 - sy) ** 0.5, s * sy, s * (2 - sy) ** 0.5);
    a.rig.lift.position.y = lift;
    for (let i = 0; i < a.rig.legs.length; i++) {
      const leg = a.rig.legs[i] as THREE.Object3D;
      leg.position.y = 0.08 + (walking ? Math.max(0, Math.sin(a.phase * 9 + i * Math.PI)) * 0.05 : 0);
    }
    a.rig.head.rotation.z = walking ? 0 : Math.sin(a.phase * 0.8) * 0.12;
    a.rig.head.rotation.x = walking ? Math.sin(a.phase * 9) * 0.05 : 0;
    space.feet(a.pose.x, a.pose.y, a.pose.z, tmp);
    a.rig.root.position.copy(tmp);
    a.rig.root.rotation.y = a.pose.yaw;
  }

  function recover(a: Animal): void {
    if (isStandable(a.cell)) return;
    a.cell = nearestStandable(isStandable, a.cell, 6, world.size.y, a.home);
    a.pose.x = a.cell.x;
    a.pose.y = a.cell.y;
    a.pose.z = a.cell.z;
    a.follower = null;
    a.bounce = BOUNCE_TIME;
  }

  return {
    count: () => animals.length,
    markDirty() {
      dirty = true;
    },
    update(dt) {
      const rm = deps.reducedMotion();
      if (dirty) {
        dirty = false;
        for (const a of animals) recover(a);
      }
      for (const a of animals) {
        if (a.follower) step(a, dt);
        else {
          a.rest -= dt;
          a.pose.x = a.cell.x;
          a.pose.y = a.cell.y;
          a.pose.z = a.cell.z;
          if (a.rest <= 0) {
            a.rest = restTime(a.rng);
            chooseRoute(a);
          }
        }
        animate(a, dt, rm);
      }
    },
    dispose() {
      for (const a of animals) a.remove();
      animals.length = 0;
    },
  };
}

/** Average-ish colour of a face canvas's centre pixel, as the body fur colour. */
function sampleColor(canvas: HTMLCanvasElement): string {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#f3ece6';
    const d = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
  } catch {
    return '#f3ece6';
  }
}
