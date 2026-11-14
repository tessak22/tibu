import type { BlockShape } from '../../core/types';
import { arch, cone, cylinder, X_FRAME, Y_FRAME } from './primitives';
import { normalize, ShapeBuilder, type ShapeTemplate } from './shapeBuilder';

/** Round parts: enough segments to look smooth and chunky, few enough for big worlds. */
const ROUND = 16;
const STUD = 10;

/** Plate/slab studs: little round bumps on top, like a toy brick. */
function studs(b: ShapeBuilder, top: number): void {
  for (const x of [0.27, 0.73]) {
    for (const z of [0.27, 0.73]) {
      cylinder(b, Y_FRAME(x, top, z), 0.105, 0.08, { segments: STUD, sideFace: 'top', capFace: 'top', capStart: false });
    }
  }
}

/** Wedge rising toward north (-z): a small lip at the south end, full height at the north. */
function slope(b: ShapeBuilder): void {
  const lip = 0.14;
  b.flat([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [0, -1, 0]);
  b.flat([[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], [0, 0, -1]);
  b.flat([[0, 0, 1], [1, 0, 1], [1, lip, 1], [0, lip, 1]], [0, 0, 1]);
  b.flat([[1, 0, 0], [1, 1, 0], [1, lip, 1], [1, 0, 1]], [1, 0, 0]);
  b.flat([[0, 0, 0], [0, 0, 1], [0, lip, 1], [0, 1, 0]], [-1, 0, 0]);
  // The sloped face reads as a "top", so it shows the block's top art.
  const n = normalize([0, 1, 1 - lip]);
  const pts = [[0, lip, 1], [1, lip, 1], [1, 1, 0], [0, 1, 0]] as const;
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
  const ids = pts.map((p, i) => b.vertex({ p, n, uv: uv[i], face: 'top' }));
  b.quad(ids[0], ids[1], ids[2], ids[3]);
}

/**
 * Wheel: a short tyre lying on its side (axle along x) with a hub poking out of both sides.
 * Content convention: tyre art is the 'top' face, hub art the east/west faces.
 */
function wheel(b: ShapeBuilder): void {
  const r = 0.47;
  const cy = 0.48;
  cylinder(b, X_FRAME(0.24, cy, 0.5), r, 0.52, { segments: ROUND + 4, sideFace: 'top', capFace: 'east', sideShade: 0.8 });
  cylinder(b, X_FRAME(0.14, cy, 0.5), 0.17, 0.72, { segments: STUD, sideFace: 'east', capFace: 'east', sideShade: 0.95 });
}

const BUILDERS: Record<Exclude<BlockShape, 'cube'>, (b: ShapeBuilder) => void> = {
  slope,
  slab: (b) => b.box([0, 0, 0], [1, 0.5, 1]),
  plate: (b) => {
    // A third of a block, matching the tray icon (src/content/art/shape-geometry.ts).
    b.box([0, 0, 0], [1, 1 / 3, 1]);
    studs(b, 1 / 3);
  },
  wheel,
  cone: (b) => cone(b, Y_FRAME(0.5, 0, 0.5), 0.47, 0.98, { segments: ROUND, sideFace: 'south', capFace: 'bottom' }),
  arch: (b) => arch(b, 0.56, 0.3, 24),
  pane: (b) => b.box([0, 0, 0.44], [1, 1, 0.56]),
  cylinder: (b) =>
    cylinder(b, Y_FRAME(0.5, 0, 0.5), 0.45, 1, { segments: ROUND, sideFace: 'south', capFace: 'top' }),
};

/** Builds the unrotated (rotation 0) template of a part. Forward is north (-z). */
export function buildTemplate(shape: Exclude<BlockShape, 'cube'>): ShapeTemplate {
  const b = new ShapeBuilder();
  BUILDERS[shape](b);
  return b.finish();
}
