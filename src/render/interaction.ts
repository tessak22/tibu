import * as THREE from 'three';
import type { BlockKey, Cell, Mode, Rotation, WorldAction, WorldModel } from '../core/types';
import type { InputHandlers } from '../input/attachInput';
import { highlightCell, resolveTapTarget, type TapTarget } from '../input/targeting';
import type { CameraController } from './cameraController';
import type { ViewEmitter } from './emitter';
import type { SceneGraph } from './sceneGraph';
import { isPart } from './shapes';
import { flattenAction } from './voxelMirror';

export interface InteractionState {
  readonly world: WorldModel | null;
  readonly mode: Mode;
  readonly selected: BlockKey | null;
  /** Smashing knocks down what rests on the block (GameView.setTopple). */
  readonly topple: boolean;
  readonly reducedMotion: boolean;
}

export interface InteractionHooks {
  getState(): InteractionState;
  onUserInput(): void;
  placementRotation(): Rotation;
  /** Lets the world sync know which cell a collapse started from. */
  setSmashOrigin(cell: Cell | null): void;
}

/** Number of extra blocks a smash knocked down (0 for a plain remove). */
export function collapsedCount(action: WorldAction): number {
  if (action.type !== 'batch') return 0;
  return Math.max(0, flattenAction(action).filter((c) => c.type === 'remove').length - 1);
}

/**
 * Turns gestures into world actions and GameView events:
 * - any mode: a tap on a tappable actor calls its onTap and nothing else;
 * - build tap on a block face: emit `tappedBlock`, then place next to that face and emit `placed`;
 * - build tap on a ghost cell: place right there;
 * - build tap on bare floor (empty world only): place and emit `placed` with tappedCell null;
 * - smash tap: smash (maybe toppling) and emit `smashed` (the unsmashable floor emits `tappedBlock`);
 * - walk tap on a block: emit `walkTo` with the cell to stand in and show a target ring;
 * - anything else (sky, no room, no selection): emit `tappedEmpty`.
 */
export function createInteraction(
  canvas: HTMLCanvasElement,
  graph: SceneGraph,
  cameraCtl: CameraController,
  emitter: ViewEmitter,
  hooks: InteractionHooks,
): InputHandlers {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const aim = (x: number, y: number): void => {
    ndc.set((x / (canvas.clientWidth || 1)) * 2 - 1, -(y / (canvas.clientHeight || 1)) * 2 + 1);
    raycaster.setFromCamera(ndc, cameraCtl.camera);
  };

  const targetAt = (x: number, y: number): TapTarget | null => {
    aim(x, y);
    const { mode } = hooks.getState();
    const ghosts = graph.ghosts;
    return resolveTapTarget({
      origin: raycaster.ray.origin,
      dir: raycaster.ray.direction,
      mode,
      isSolid: (cx, cy, cz) => graph.mirror.isSolid(cx, cy, cz),
      floorEmpty: graph.mirror.floorEmpty(),
      size: graph.mirror.size,
      isGhost: mode === 'build' && ghosts.count() > 0 ? (cx, cy, cz) => ghosts.has(cx, cy, cz) : undefined,
    });
  };

  /** Ghosts carry their own rotation when the child holds the matching block. */
  const rotationFor = (target: TapTarget | null): Rotation => {
    const { selected } = hooks.getState();
    const ghost = target?.kind === 'ghost' ? graph.ghosts.at(target.cell) : null;
    if (ghost && ghost.block === selected && ghost.rot !== undefined) return ghost.rot;
    return hooks.placementRotation();
  };

  const showHighlight = (x: number, y: number): void => {
    const target = hooks.getState().mode === 'walk' ? null : targetAt(x, y);
    graph.ghosts.setHovered(target?.kind === 'ghost' ? target.cell : null);
    if (!target) {
      graph.highlight.hide();
      return;
    }
    graph.highlight.setRotation(rotationFor(target));
    graph.highlight.show(highlightCell(target));
  };

  const hidePress = (): void => {
    graph.highlight.hide();
    graph.ghosts.setHovered(null);
  };

  const emitTapped = (world: WorldModel, cell: Cell): void => {
    const block = world.get(cell);
    if (block) emitter.emit('tappedBlock', { cell, block });
  };

  const place = (world: WorldModel, cell: Cell, tappedCell: Cell | null, rot: Rotation): boolean => {
    const { selected, mode } = hooks.getState();
    if (!selected || mode !== 'build') return false;
    const finalRot: Rotation = isPart(graph.looks.shape(selected)) ? rot : 0;
    const action = world.place(cell, selected, finalRot);
    if (!action || action.type !== 'place') return false;
    emitter.emit('placed', { cell: action.cell, block: action.block, tappedCell, rot: finalRot });
    return true;
  };

  const smash = (world: WorldModel, cell: Cell, topple: boolean): void => {
    const block = world.get(cell);
    hooks.setSmashOrigin(cell);
    let action: WorldAction | null;
    try {
      // Older world models without smash() fall back to a plain remove.
      action = typeof world.smash === 'function' ? world.smash(cell, { topple }) : world.remove(cell);
    } finally {
      hooks.setSmashOrigin(null);
    }
    if (!action || !block) {
      emitTapped(world, cell);
      return;
    }
    emitter.emit('smashed', { cell, block, collapsed: collapsedCount(action) });
  };

  const tap = (x: number, y: number): void => {
    hidePress();
    aim(x, y);
    const actor = graph.actors.hit(raycaster);
    if (actor?.onTap) {
      actor.onTap();
      return;
    }
    const { world, topple } = hooks.getState();
    const target = world ? targetAt(x, y) : null;
    if (!world || !target) {
      emitter.emit('tappedEmpty', {});
      return;
    }
    switch (target.kind) {
      case 'smash':
        smash(world, target.cell, topple);
        return;
      case 'touch':
        emitTapped(world, target.tapped);
        return;
      case 'walk':
        graph.walkMarker.show(target.cell, hooks.getState().reducedMotion);
        emitter.emit('walkTo', { cell: target.cell });
        return;
      case 'ghost':
        if (!place(world, target.cell, null, rotationFor(target))) emitter.emit('tappedEmpty', {});
        return;
      case 'place':
        if (target.tapped) emitTapped(world, target.tapped);
        if (!place(world, target.cell, target.tapped, rotationFor(target)) && !target.tapped) {
          emitter.emit('tappedEmpty', {});
        }
    }
  };

  return {
    onPress: (x, y) => {
      hooks.onUserInput();
      showHighlight(x, y);
    },
    onPressCancel: hidePress,
    onTap: (x, y) => {
      hooks.onUserInput();
      tap(x, y);
    },
    onOrbit: (dx, dy) => {
      hooks.onUserInput();
      cameraCtl.orbitBy(dx, dy, canvas.clientHeight || 700);
    },
    onPinch: (scale) => {
      hooks.onUserInput();
      cameraCtl.zoom(scale);
    },
    onPan: (dx, dy) => {
      if (cameraCtl.pan(dx, dy, canvas.clientHeight || 700)) hooks.onUserInput();
    },
    onHover: (x, y) => showHighlight(x, y),
    onHoverEnd: hidePress,
  };
}
