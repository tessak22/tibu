import type { Cell } from '../../core/types';
import { freeSquare, markUsed } from './decor';
import type { Writer } from './fill';
import type { Rng } from './noise';
import type { ExplorePalette } from './palette';
import { col, type Island, type Terrain } from './terrain';

/** Spots inside / on top of discovery builds, offered first as chest spots. */
export interface Discovery {
  readonly kind: 'hut' | 'tower' | 'garden';
  readonly chest: Cell;
}

/** Nearest level, free square of the given half-size to the island center, or null. */
function findSite(t: Terrain, isl: Island, half: number): [number, number] | null {
  const reach = Math.ceil(isl.radius);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const d = dx * dx + dz * dz;
      if (d >= bestD) continue;
      const x = isl.cx + dx;
      const z = isl.cz + dz;
      if (col(t, x, z) >= 0 && t.island[col(t, x, z)] === isl.id && freeSquare(t, x, z, half)) {
        best = [x, z];
        bestD = d;
      }
    }
  }
  return best;
}

/** Unit direction (one axis) from (x, z) towards a target. */
function facing(x: number, z: number, tx: number, tz: number): [number, number] {
  const dx = tx - x;
  const dz = tz - z;
  return Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
}

/** 5x5 hut: 3-high walls, door facing the main island, windows, flat roof. Chest inside at the back. */
function hut(t: Terrain, w: Writer, p: ExplorePalette, x: number, z: number, door: [number, number]): Cell {
  const h = t.height[col(t, x, z)];
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      w.seed({ x: x + dx, y: h + 4, z: z + dz }, p.hut.roof);
      if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
      const isDoor = dx === door[0] * 2 && dz === door[1] * 2;
      const isWindow = !isDoor && (dx === 0 || dz === 0);
      for (let y = 1; y <= 3; y++) {
        if (isDoor && y <= 2) continue;
        w.seed({ x: x + dx, y: h + y, z: z + dz }, isWindow && y === 2 ? p.hut.window : p.hut.wall);
      }
    }
  }
  w.seed({ x, y: h + 5, z }, p.light);
  markUsed(t, x, z, 3);
  return { x: x - door[0], y: h + 1, z: z - door[1] };
}

/**
 * 3x3 lookout tower, 5 high, with a staircase of 1-block steps wrapping around it on the
 * 5x5 ring. The last step lands on a side (not corner) cell so you can walk onto the top.
 */
function tower(t: Terrain, w: Writer, p: ExplorePalette, x: number, z: number, rng: Rng): Cell {
  const h = t.height[col(t, x, z)];
  const height = 5;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let y = 1; y <= height; y++) w.seed({ x: x + dx, y: h + y, z: z + dz }, p.tower);
    }
  }
  const ring: [number, number][] = [];
  for (let k = -2; k < 2; k++) ring.push([k, -2]);
  for (let k = -2; k < 2; k++) ring.push([2, k]);
  for (let k = 2; k > -2; k--) ring.push([k, 2]);
  for (let k = 2; k > -2; k--) ring.push([-2, k]);
  // Corners sit at ring indices 0, 4, 8, 12; start at 1 + 4n so the last step (start + 4) is a side cell.
  const start = 1 + 4 * rng.int(0, 3);
  for (let s = 0; s < height; s++) {
    const [dx, dz] = ring[(start + s) % ring.length];
    for (let y = 1; y <= s + 1; y++) w.seed({ x: x + dx, y: h + y, z: z + dz }, p.tower);
  }
  const [cx, cz] = ring[(start + 8) % ring.length]; // far side of the top
  w.seed({ x: x + Math.sign(cx), y: h + height + 1, z: z + Math.sign(cz) }, p.light);
  markUsed(t, x, z, 3);
  return { x, y: h + height + 1, z };
}

/** 5x5 garden bed in stripes with little corner posts. Chest in the middle. */
function garden(t: Terrain, w: Writer, p: ExplorePalette, x: number, z: number): Cell {
  const h = t.height[col(t, x, z)];
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      w.seed({ x: x + dx, y: h, z: z + dz }, p.garden[Math.abs(dz) % p.garden.length]);
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) w.seed({ x: x + dx, y: h + 1, z: z + dz }, p.hut.wall);
    }
  }
  markUsed(t, x, z, 2);
  return { x, y: h + 1, z };
}

/** A planned discovery build: a level 7x7 site chosen before hills are added. */
export interface Site {
  readonly kind: Discovery['kind'];
  readonly x: number;
  readonly z: number;
}

/** Half-size of the square a site keeps level and free (7x7: build + a walkway around it). */
export const SITE_HALF = 3;

/**
 * Picks sites for a hut, a tower and a garden on flat ground, one per satellite island where
 * possible, falling back to any island (the spawn area is reserved, so never there).
 * Runs before relief so sites are still level; relief keeps its hills away from them.
 */
export function planDiscoveries(t: Terrain, rng: Rng): Site[] {
  const satellites = rng.shuffle(t.islands.slice(1));
  const hosts = [...satellites, t.islands[0]];
  const out: Site[] = [];
  const kinds: Discovery['kind'][] = ['hut', 'tower', 'garden'];
  kinds.forEach((kind, k) => {
    for (let n = 0; n < hosts.length; n++) {
      const isl = n < satellites.length ? satellites[(k + n) % satellites.length] : hosts[n];
      const site = findSite(t, isl, SITE_HALF);
      if (!site) continue;
      markUsed(t, site[0], site[1], SITE_HALF);
      out.push({ kind, x: site[0], z: site[1] });
      return;
    }
  });
  return out;
}

/** Builds the planned sites (after the ground is written). */
export function buildDiscoveries(t: Terrain, w: Writer, rng: Rng, palette: ExplorePalette, sites: readonly Site[]): Discovery[] {
  const main = t.islands[0];
  return sites.map(({ kind, x, z }) => {
    if (kind === 'hut') return { kind, chest: hut(t, w, palette, x, z, facing(x, z, main.cx, main.cz)) };
    if (kind === 'tower') return { kind, chest: tower(t, w, palette, x, z, rng) };
    return { kind, chest: garden(t, w, palette, x, z) };
  });
}
