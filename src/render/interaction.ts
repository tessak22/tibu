import * as THREE from 'three';
import type { BlockKey, Cell, Mode, WorldModel } from '../core/types';
import type { InputHandlers } from '../input/attachInput';
import { highlightCell, resolveTapTarget, type TapTarget } from '../input/targeting';
import type { CameraController } from './cameraController';
import type { ViewEmitter } from './emitter';
import type { SceneGraph } from './sceneGraph';

export interface InteractionState {
  readonly world: WorldModel | null;
  readonly mode: Mode;
  readonly selected: BlockKey | null;
}

/**
 * Turns gestures into world actions and GameView events:
 * - build tap on a block face: emit `tappedBlock`, then place next to that face and emit `placed`;
 * - build tap on bare floor (empty world only): place and emit `placed` with tappedCell null;
 * - smash tap: remove and emit `smashed` (the unsmashable floor emits `tappedBlock` instead);
 * - anything else (sky, no room, no selection): emit `tappedEmpty`.
 */
export function createInteraction(
  canvas: HTMLCanvasElement,
  graph: SceneGraph,
  cameraCtl: CameraController,
  emitter: ViewEmitter,
  getState: () => InteractionState,
  onUserInput: () => void,
): InputHandlers {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const targetAt = (x: number, y: number): TapTarget | null => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    raycaster.setFromCamera(ndc, cameraCtl.camera);
    const { origin, direction } = raycaster.ray;
    return resolveTapTarget({
      origin,
      dir: direction,
      mode: getState().mode,
      isSolid: (cx, cy, cz) => graph.mirror.isSolid(cx, cy, cz),
      floorEmpty: graph.mirror.floorEmpty(),
    });
  };

  const showHighlight = (x: number, y: number): void => {
    const target = targetAt(x, y);
    if (target) graph.highlight.show(highlightCell(target));
    else graph.highlight.hide();
  };

  const emitTapped = (world: WorldModel, cell: Cell): void => {
    const block = world.get(cell);
    if (block) emitter.emit('tappedBlock', { cell, block });
  };

  const tap = (x: number, y: number): void => {
    graph.highlight.hide();
    const { world, mode, selected } = getState();
    const target = world ? targetAt(x, y) : null;
    if (!world || !target) {
      emitter.emit('tappedEmpty', {});
      return;
    }
    if (target.kind === 'smash') {
      const action = world.remove(target.cell);
      if (action) emitter.emit('smashed', { cell: action.cell, block: action.block });
      else emitTapped(world, target.cell);
      return;
    }
    if (target.kind === 'touch') {
      emitTapped(world, target.tapped);
      return;
    }
    if (target.tapped) emitTapped(world, target.tapped);
    const action = selected && mode === 'build' ? world.place(target.cell, selected) : null;
    if (action) {
      emitter.emit('placed', { cell: action.cell, block: action.block, tappedCell: target.tapped });
    } else if (!target.tapped) {
      emitter.emit('tappedEmpty', {});
    }
  };

  return {
    onPress: (x, y) => {
      onUserInput();
      showHighlight(x, y);
    },
    onPressCancel: () => graph.highlight.hide(),
    onTap: (x, y) => {
      onUserInput();
      tap(x, y);
    },
    onOrbit: (dx, dy) => {
      onUserInput();
      cameraCtl.orbitBy(dx, dy, canvas.clientHeight || 700);
    },
    onPinch: (scale) => {
      onUserInput();
      cameraCtl.zoom(scale);
    },
    onHover: (x, y) => showHighlight(x, y),
    onHoverEnd: () => graph.highlight.hide(),
  };
}
