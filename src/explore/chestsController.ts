/**
 * Renders chests from world.entities(), sparkles the closed ones, and opens a chest when the
 * explorer stands next to it (or taps it while near): lid pops, confetti, a sticker floats up.
 */
import * as THREE from 'three';
import type { AudioSystem, Cell, GameView, WorldEntity, WorldModel } from '../core/types';
import { chooseSticker } from './chests';
import { cellKey, isAdjacent } from './route';
import type { Space } from './space';
import { STICKER_IDS } from './stickerIds';
import type { Effects } from './three/effects';
import { buildChest, type ChestRig } from './three/chestMesh';

const OPEN_TIME = 0.5;
const SYNC_INTERVAL = 1;
const LID_OPEN = -1.95;
const SPARKLE_RANGE2 = 24 * 24;

interface ChestView {
  entity: WorldEntity;
  readonly rig: ChestRig;
  readonly remove: () => void;
  open: number;
  wiggle: number;
  phase: number;
}

export interface ChestsDeps {
  readonly world: WorldModel;
  readonly view: Pick<GameView, 'confetti' | 'addActor'>;
  readonly audio: AudioSystem;
  readonly space: Space;
  readonly effects: Effects;
  readonly reducedMotion: () => boolean;
  readonly characterCell: () => Cell;
  readonly walkTo: (cell: Cell) => void;
  readonly celebrate: () => void;
  readonly onStickerFound: (id: string) => void;
  readonly isFound: (id: string) => boolean;
}

export interface ChestsController {
  /** The explorer arrived at `cell`; opens any closed chest next to it. True if one opened. */
  arrivedAt(cell: Cell): boolean;
  /** Advances one frame; returns true while a lid opens or a chest wiggles. */
  update(dt: number): boolean;
  dispose(): void;
}

export const STICKER_FOUND_LINE = 'explore.sticker-found';
export const STICKER_FOUND_TEXT = 'You found a sticker!';

export function createChests(deps: ChestsDeps): ChestsController {
  const views = new Map<string, ChestView>();
  const sessionFound = new Set<string>();
  const tmp = new THREE.Vector3();
  let syncIn = 0;

  const found = (id: string): boolean => sessionFound.has(id) || deps.isFound(id);

  function place(v: ChestView): void {
    const c = v.entity.cell;
    deps.space.feet(c.x, c.y, c.z, tmp);
    v.rig.root.position.copy(tmp);
    // Face the chest a little toward the world centre for a friendlier look.
    v.rig.root.rotation.y = ((c.x * 31 + c.z * 17) % 4) * (Math.PI / 2);
    v.rig.lid.rotation.x = v.entity.opened ? LID_OPEN : 0;
    v.open = v.entity.opened ? 1 : 0;
    for (const s of v.rig.sparkles) s.visible = !v.entity.opened;
  }

  function sync(): void {
    const seen = new Set<string>();
    for (const e of deps.world.entities()) {
      if (e.kind !== 'chest') continue;
      seen.add(e.id);
      const existing = views.get(e.id);
      if (existing) {
        if (!sameSpot(existing.entity, e) || existing.entity.opened !== e.opened) {
          existing.entity = e;
          place(existing);
        }
        continue;
      }
      const rig = buildChest();
      const v: ChestView = { entity: e, rig, remove: () => undefined, open: 0, wiggle: 0, phase: views.size * 1.3 };
      const remove = deps.view.addActor(rig.root, { onTap: () => tapped(e.id) });
      views.set(e.id, { ...v, remove });
      place(views.get(e.id) as ChestView);
    }
    for (const [id, v] of views) {
      if (seen.has(id)) continue;
      v.remove();
      views.delete(id);
    }
  }

  function tapped(id: string): void {
    const v = views.get(id);
    if (!v) return;
    if (v.entity.opened) {
      v.wiggle = 0.5;
      deps.audio.sfx('tap');
      return;
    }
    if (isAdjacent(deps.characterCell(), v.entity.cell)) {
      openChest(v);
      return;
    }
    deps.audio.sfx('tap');
    v.wiggle = 0.5;
    deps.walkTo(v.entity.cell);
  }

  function openChest(v: ChestView): void {
    if (v.entity.opened) return;
    const sticker = chooseSticker(v.entity.sticker, STICKER_IDS, found);
    sessionFound.add(sticker);
    const opened: WorldEntity = { ...v.entity, sticker, opened: true };
    v.entity = opened;
    v.open = 0.0001;
    for (const s of v.rig.sparkles) s.visible = false;
    deps.world.setEntity(opened);
    const c = opened.cell;
    deps.space.feet(c.x, c.y, c.z, tmp);
    deps.effects.sticker(sticker, tmp.x, tmp.y + 0.6, tmp.z);
    deps.effects.burst(tmp.x, tmp.y + 0.5, tmp.z, 0.8);
    deps.view.confetti(c);
    deps.audio.sfx('celebrate');
    void deps.audio.speak(STICKER_FOUND_LINE, STICKER_FOUND_TEXT);
    deps.celebrate();
    deps.onStickerFound(sticker);
  }

  function animate(v: ChestView, dt: number, me: Cell, rm: boolean): void {
    v.phase += dt;
    if (v.open > 0 && v.open < 1) {
      v.open = Math.min(1, v.open + dt / OPEN_TIME);
      const k = v.open;
      const overshoot = rm ? k : 1 - (1 - k) * (1 - k) * (1 - 2.2 * k);
      v.rig.lid.rotation.x = LID_OPEN * overshoot;
    }
    if (v.wiggle > 0) {
      v.wiggle -= dt;
      const w = Math.max(0, v.wiggle);
      v.rig.root.scale.set(1 + Math.sin(w * 30) * 0.06 * w, 1 - Math.sin(w * 30) * 0.06 * w, 1);
      if (v.entity.opened) v.rig.lid.rotation.x = LID_OPEN + Math.sin(w * 25) * 0.15 * w;
    }
    if (v.entity.opened) return;
    const dx = me.x - v.entity.cell.x;
    const dz = me.z - v.entity.cell.z;
    const near = dx * dx + dz * dz < SPARKLE_RANGE2;
    const sparkles = v.rig.sparkles;
    for (let i = 0; i < sparkles.length; i++) {
      const s = sparkles[i] as THREE.Mesh;
      s.visible = near;
      if (!near) continue;
      const a = v.phase * (rm ? 0.4 : 1.2) + (i * Math.PI * 2) / sparkles.length;
      s.position.set(Math.cos(a) * 0.42, 0.55 + Math.sin(v.phase * 2 + i) * 0.12, Math.sin(a) * 0.42);
      s.scale.setScalar(0.035 + Math.max(0, Math.sin(v.phase * 3 + i * 2)) * 0.035);
      s.rotation.y = v.phase * 2;
    }
    if (!rm) v.rig.lid.rotation.x = -(Math.max(0, Math.sin(v.phase * 1.7)) ** 8) * 0.12;
  }

  return {
    arrivedAt(cell) {
      for (const v of views.values()) {
        if (!v.entity.opened && isAdjacent(cell, v.entity.cell)) {
          openChest(v);
          return true;
        }
      }
      return false;
    },
    update(dt) {
      syncIn -= dt;
      if (syncIn <= 0) {
        syncIn = SYNC_INTERVAL;
        sync();
      }
      const me = deps.characterCell();
      const rm = deps.reducedMotion();
      let moving = false;
      for (const v of views.values()) {
        animate(v, dt, me, rm);
        if ((v.open > 0 && v.open < 1) || v.wiggle > 0) moving = true;
      }
      return moving;
    },
    dispose() {
      for (const v of views.values()) v.remove();
      views.clear();
    },
  };
}

function sameSpot(a: WorldEntity, b: WorldEntity): boolean {
  return cellKey(a.cell) === cellKey(b.cell);
}
