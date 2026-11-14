import type { FaceName } from '../core/types';

export interface FaceDef {
  readonly name: FaceName;
  readonly normal: readonly [number, number, number];
  /** Unit-cube corners in texture order: bottom-left, bottom-right, top-right, top-left (CCW from outside). */
  readonly corners: readonly (readonly [number, number, number])[];
}

/** Convention: north = -z, south = +z, east = +x, west = -x, top = +y. */
export const FACES: readonly FaceDef[] = [
  { name: 'east', normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { name: 'west', normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { name: 'top', normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { name: 'bottom', normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { name: 'south', normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { name: 'north', normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

/** Material order of three's BoxGeometry: +x, -x, +y, -y, +z, -z. */
export const BOX_FACE_ORDER: readonly FaceName[] = ['east', 'west', 'top', 'bottom', 'south', 'north'];
