import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Edges sharper than this (degrees) get an outline: box corners and part silhouettes, not facets. */
export const OUTLINE_ANGLE = 30;
/** Outline bar thickness in cells: thick enough to read on a tablet, thin enough to stay neat. */
export const OUTLINE_THICKNESS = 0.045;

const Z = new THREE.Vector3(0, 0, 1);

/**
 * The feature edges of a geometry as [ax, ay, az, bx, by, bz] segments. Pure geometry: uses
 * three's EdgesGeometry so parts (slopes, cylinders, arches) outline their real shape.
 */
export function outlineSegments(geometry: THREE.BufferGeometry, angle = OUTLINE_ANGLE): number[][] {
  const edges = new THREE.EdgesGeometry(geometry, angle);
  const pos = edges.getAttribute('position');
  const out: number[][] = [];
  for (let i = 0; i + 1 < pos.count; i += 2) {
    out.push([pos.getX(i), pos.getY(i), pos.getZ(i), pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)]);
  }
  edges.dispose();
  return out;
}

/**
 * One merged mesh geometry of thin square bars along every feature edge. Real bars (not GL lines,
 * which are always 1px on iPad Safari) so the outline stays bold at any zoom.
 */
export function outlineGeometry(geometry: THREE.BufferGeometry, thickness = OUTLINE_THICKNESS): THREE.BufferGeometry {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const bars: THREE.BufferGeometry[] = [];
  for (const [ax, ay, az, bx, by, bz] of outlineSegments(geometry)) {
    a.set(ax as number, ay as number, az as number);
    b.set(bx as number, by as number, bz as number);
    const len = a.distanceTo(b);
    if (len < 1e-4) continue;
    // Overlap the corners a little so neighbouring bars meet without gaps.
    const bar = new THREE.BoxGeometry(thickness, thickness, len + thickness);
    bar.deleteAttribute('uv');
    dir.subVectors(b, a).normalize();
    q.setFromUnitVectors(Z, dir);
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, one);
    bar.applyMatrix4(m);
    bars.push(bar);
  }
  const merged = bars.length > 0 ? mergeGeometries(bars, false) : null;
  for (const bar of bars) bar.dispose();
  return merged ?? new THREE.BufferGeometry();
}
