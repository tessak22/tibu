import * as THREE from 'three';
import type { Cell, WorldAction } from '../core/types';
import { planCollapse, type FallenBlock } from './effects/collapsePlan';
import type { SceneGraph } from './sceneGraph';
import type { CellChange } from './voxelMirror';

export interface WorldSyncContext {
  reducedMotion(): boolean;
  /** The cell the child just smashed (set by the interaction around world.smash), if any. */
  smashOrigin(): Cell | null;
  requestFrame(): void;
}

const center = (c: Cell): THREE.Vector3 => new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5);

/** First solid surface at or below `fromY` in a column (0 = the bottom of the world). */
function groundAt(graph: SceneGraph, x: number, z: number, fromY: number): number {
  for (let y = Math.min(fromY, graph.mirror.size.y) - 1; y >= 0; y--) if (graph.mirror.isSolid(x, y, z)) return y + 1;
  return 0;
}

/**
 * Keeps the scene in step with world changes: mirror + chunk updates, plus the friendly effects
 * (pop on remove, bounce on place, tumbling towers on a collapse, pop-back-in on its undo).
 */
export function createWorldSync(graph: SceneGraph, ctx: WorldSyncContext) {
  const single = (c: CellChange, cause: 'action' | 'undo'): void => {
    if (c.type === 'remove') {
      // Smashed or undone while still bouncing: drop the overlay so no ghost block lingers.
      graph.bounce.cancel(c.cell);
      graph.particles.pop(center(c.cell), graph.looks.averageColor(c.block));
      if (cause === 'action') graph.highlight.hide();
    } else {
      graph.collapse.cancel(c.cell);
      graph.bounce.start(c.cell, c.block, true, c.rot ?? 0);
    }
  };

  const collapse = (flat: readonly CellChange[]): void => {
    const fallen: FallenBlock[] = [];
    for (const c of flat) {
      if (c.type !== 'remove') continue;
      graph.bounce.cancel(c.cell);
      fallen.push({ cell: c.cell, block: c.block, rot: c.rot ?? 0 });
    }
    graph.collapse.start(
      planCollapse({
        origin: ctx.smashOrigin(),
        fallen,
        groundAt: (x, z, fromY) => groundAt(graph, x, z, fromY),
        reducedMotion: ctx.reducedMotion(),
      }),
    );
    graph.highlight.hide();
  };

  /** Undo of a collapse: every block pops back in with a lively bounce. */
  const restore = (flat: readonly CellChange[]): void => {
    for (const c of flat) {
      if (c.type === 'place') {
        graph.collapse.cancel(c.cell);
        graph.bounce.start(c.cell, c.block, false, c.rot ?? 0);
      } else {
        single(c, 'undo');
      }
    }
  };

  return (change: WorldAction, cause: 'action' | 'undo'): void => {
    const flat = graph.mirror.apply(change);
    for (const c of flat) graph.chunks.markCell(c.cell);
    graph.glow.markDirty();
    if (change.type !== 'batch') {
      if (flat[0]) single(flat[0], cause);
    } else if (cause === 'action' && flat.some((c) => c.type === 'remove')) {
      collapse(flat);
      for (const c of flat) if (c.type === 'place') single(c, cause);
    } else {
      restore(flat);
    }
    ctx.requestFrame();
  };
}
