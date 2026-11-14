/**
 * Drives the explorer buddy: route following, hops, idle life (breathing, blinking, sprout
 * sway), happy arrival jumps, shrugs, giggles, and recovery when the world changes under it.
 */
import * as THREE from 'three';
import type { Cell, WorldModel } from '../core/types';
import {
  advanceFollower,
  createFollower,
  createPose,
  facing,
  followerDone,
  followerTarget,
  GENTLE_STEPS,
  stepPose,
  turnToward,
  type Follower,
} from './follower';
import { nearestStandable, planRoute, type WalkFns } from './route';
import type { Space } from './space';
import { buildCharacter, type CharacterRig, type CharacterVariant } from './three/characterMesh';

const MAX_ROUTE_NODES = 12_000;
const RECOVER_RADIUS = 8;

export type Gesture = 'none' | 'happy' | 'shrug' | 'giggle' | 'land' | 'pop';

export interface CharacterHooks {
  /** A step up or down began (play a soft hop sound). */
  onHop(): void;
  /** Arrived at a cell. Return true to stop walking here (e.g. a chest opened). */
  onArrive(cell: Cell): boolean;
  /** The walk ended without reaching the tapped spot. */
  onShrug(): void;
}

export interface CharacterController {
  readonly rig: CharacterRig;
  cell(): Cell;
  walkTo(target: Cell): void;
  /** Instantly place at a cell (recenter). */
  teleport(cell: Cell): void;
  gesture(kind: Gesture): void;
  /** The world changed: re-check footing on the next frame. */
  markDirty(): void;
  /** Advances one frame; returns true while the buddy walks, hops or plays a gesture. */
  update(dt: number): boolean;
  isWalking(): boolean;
}

export interface CharacterDeps {
  readonly world: WorldModel;
  readonly walk: WalkFns;
  readonly space: Space;
  readonly spawn: Cell;
  readonly reducedMotion: () => boolean;
  readonly hooks: CharacterHooks;
  readonly variant?: CharacterVariant;
}

export function createCharacterController(deps: CharacterDeps): CharacterController {
  const { world, walk, space, hooks } = deps;
  const rig = buildCharacter(deps.variant);
  const isStandable = (c: Cell): boolean => walk.standable(world, c);
  let current: Cell = nearestStandable(isStandable, deps.spawn, RECOVER_RADIUS, world.size.y, deps.spawn);
  const pose = createPose(current);
  let yawTarget = 0;
  let follower: Follower | null = null;
  let destination: Cell | null = null;
  let pending: Cell | null = null;
  let reachedGoal = true;
  let dirty = false;
  let gesture: Gesture = 'none';
  let gestureT = 0;
  let time = 0;
  let walkPhase = 0;
  let blinkIn = 2.5;
  const tmp = new THREE.Vector3();

  function startRoute(target: Cell): void {
    const route = planRoute(walk, world, current, target, MAX_ROUTE_NODES);
    destination = target;
    reachedGoal = route.reached;
    if (route.steps.length === 0) {
      follower = null;
      setGesture(route.reached ? 'happy' : 'shrug');
      if (!route.reached) hooks.onShrug();
      return;
    }
    follower = createFollower(current, route.steps);
  }

  function setGesture(kind: Gesture): void {
    gesture = kind;
    gestureT = 0;
  }

  function recover(): void {
    if (isStandable(current)) return;
    const safe = nearestStandable(isStandable, current, RECOVER_RADIUS, world.size.y, deps.spawn);
    follower = createFollower(current, [safe]);
    destination = null;
    reachedGoal = true;
    hooks.onHop();
  }

  function onArrived(): void {
    if (!follower) return;
    current = follower.from;
    if (hooks.onArrive(current)) {
      follower = null;
      pending = null;
      return;
    }
    if (pending) {
      const next = pending;
      pending = null;
      startRoute(next);
      return;
    }
    const next = followerTarget(follower);
    if (next && !isStandable(next) && destination) {
      startRoute(destination);
      return;
    }
    if (next && next.y !== current.y) hooks.onHop();
    if (followerDone(follower)) {
      follower = null;
      setGesture(reachedGoal ? 'happy' : 'shrug');
      if (!reachedGoal) hooks.onShrug();
    }
  }

  function animateWalking(dt: number, rm: boolean): void {
    if (!follower) return;
    const target = followerTarget(follower);
    if (!target) return;
    const before = follower.from;
    advanceFollower(follower, dt, GENTLE_STEPS);
    const arrivedNow = follower.from !== before;
    const from = arrivedNow ? before : follower.from;
    const to = arrivedNow ? target : (followerTarget(follower) ?? target);
    stepPose(from, to, arrivedNow ? 1 : follower.t, rm ? 0.15 : 0.35, pose);
    yawTarget = facing(from, to, yawTarget);
    walkPhase += dt * (Math.PI * 2) / GENTLE_STEPS.flat / 2;
    if (arrivedNow) {
      if (before.y !== target.y && gesture === 'none') setGesture('land');
      onArrived();
    }
  }

  function animateBody(dt: number, rm: boolean): void {
    const walking = follower !== null;
    pose.yaw = turnToward(pose.yaw, yawTarget, 10, dt);
    gestureT += dt;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    // Arm angles: 0 hangs down, positive raises the arm outward (mirrored per side).
    let armL = 0.2;
    let armR = 0.2;
    const breathe = Math.sin(time * 2.2) * (rm ? 0.008 : 0.02);
    sy += breathe;
    sx -= breathe * 0.5;
    if (walking) {
      const s = Math.sin(walkPhase * 2);
      lift = Math.abs(Math.sin(walkPhase)) * (rm ? 0.02 : 0.06) * (pose.hop > 0 ? 0 : 1);
      armL = 0.25 + s * 0.35;
      armR = 0.25 - s * 0.35;
      rig.footL.position.y = 0.04 + Math.max(0, Math.sin(walkPhase)) * 0.05;
      rig.footR.position.y = 0.04 + Math.max(0, -Math.sin(walkPhase)) * 0.05;
      rig.squash.rotation.z = Math.sin(walkPhase) * (rm ? 0.02 : 0.07);
      if (pose.hop > 0) {
        const stretch = Math.sin(pose.hop * Math.PI) * 0.12;
        sy += stretch;
        sx -= stretch * 0.5;
      }
    } else {
      rig.footL.position.y = 0.04;
      rig.footR.position.y = 0.04;
      rig.squash.rotation.z *= 0.85;
    }
    const g = applyGesture(rm);
    lift += g.lift;
    sy *= g.sy;
    sx *= g.sx;
    if (!Number.isNaN(g.armL)) {
      armL = g.armL;
      armR = g.armR;
    } else if (g.wave) {
      armR = 2.4 + Math.sin(gestureT * 16) * 0.4;
      armL = g.both ? 2.4 + Math.sin(gestureT * 16 + 1) * 0.4 : armL;
    }
    rig.armL.rotation.z = -armL;
    rig.armR.rotation.z = armR;
    rig.squash.scale.set(sx, sy, sx);
    rig.lift.position.y = lift;
    rig.sprout.rotation.z = Math.sin(time * 3.1) * 0.12 + (walking ? Math.sin(walkPhase * 2) * 0.15 : 0);
    rig.sprout.rotation.x = -lift * 1.5;

    blinkIn -= dt;
    const blinkY = blinkIn < 0.12 ? 0.15 : 1;
    if (blinkIn <= 0) blinkIn = 2 + ((time * 7.3) % 3);
    rig.eyes.scale.y = blinkY;

    space.feet(pose.x, pose.y, pose.z, tmp);
    rig.root.position.copy(tmp);
    rig.root.rotation.y = pose.yaw;
  }

  const out = { lift: 0, sx: 1, sy: 1, wave: false, both: false, armL: NaN, armR: NaN };
  function applyGesture(rm: boolean): typeof out {
    out.lift = 0;
    out.sx = 1;
    out.sy = 1;
    out.wave = false;
    out.both = false;
    out.armL = NaN;
    out.armR = NaN;
    const t = gestureT;
    const amp = rm ? 0.35 : 1;
    switch (gesture) {
      case 'land':
        if (t < 0.25) {
          const k = Math.sin((t / 0.25) * Math.PI) * 0.22 * amp;
          out.sy = 1 - k;
          out.sx = 1 + k * 0.6;
        } else gesture = 'none';
        break;
      case 'happy':
      case 'giggle':
      case 'pop': {
        const dur = gesture === 'pop' ? 0.5 : 1.1;
        if (t < dur) {
          const jumps = gesture === 'giggle' ? 2 : 1;
          const p = (t / dur) * jumps;
          const k = p % 1;
          out.lift = Math.sin(k * Math.PI) * 0.35 * amp;
          if (k < 0.15 || k > 0.85) {
            const sq = 0.18 * amp * (k < 0.15 ? 1 - k / 0.15 : (k - 0.85) / 0.15);
            out.sy = 1 - sq;
            out.sx = 1 + sq * 0.6;
          }
          out.wave = gesture !== 'pop';
          out.both = gesture === 'happy';
          if (gesture === 'giggle' && !rm) rig.squash.rotation.y = Math.sin(t * 14) * 0.3;
        } else {
          rig.squash.rotation.y = 0;
          gesture = 'none';
        }
        break;
      }
      case 'shrug':
        if (t < 1) {
          const k = Math.sin(Math.min(1, t / 0.9) * Math.PI);
          out.sy = 1 - 0.06 * k;
          rig.squash.rotation.z = Math.sin(t * 10) * 0.08 * k * amp;
          rig.eyes.position.x = Math.sin(t * 6) * 0.03 * k;
          // Arms up and out: a little "hmm?".
          out.armL = 0.2 + 1.1 * k;
          out.armR = 0.2 + 1.1 * k;
        } else {
          rig.eyes.position.x = 0;
          gesture = 'none';
        }
        break;
      case 'none':
        break;
    }
    return out;
  }

  return {
    rig,
    cell: () => current,
    isWalking: () => follower !== null,
    walkTo(target) {
      if (follower && follower.t > 0) {
        pending = target;
        destination = target;
        return;
      }
      startRoute(target);
    },
    teleport(cell) {
      current = nearestStandable(isStandable, cell, RECOVER_RADIUS, world.size.y, cell);
      follower = null;
      pending = null;
      destination = null;
      pose.x = current.x;
      pose.y = current.y;
      pose.z = current.z;
      pose.hop = 0;
      setGesture('pop');
    },
    gesture: setGesture,
    markDirty() {
      dirty = true;
    },
    update(dt) {
      time += dt;
      const rm = deps.reducedMotion();
      if (dirty && (!follower || follower.t === 0)) {
        dirty = false;
        recover();
      }
      if (follower) animateWalking(dt, rm);
      else {
        pose.x = current.x;
        pose.y = current.y;
        pose.z = current.z;
        pose.hop = 0;
      }
      animateBody(dt, rm);
      return follower !== null || gesture !== 'none';
    },
  };
}

