import { describe, expect, it } from 'vitest';
import { FACE_NAMES, type Rotation } from '../../../src/core/types';
import { isGlassLike } from '../../../src/render/blockLook';
import { templateToGeometry } from '../../../src/render/shapeGeometry';
import { PART_SHAPES, shapeTemplate, type ShapeTemplate } from '../../../src/render/shapes';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];

function bounds(t: ShapeTemplate) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], t.positions[i]);
    max[i % 3] = Math.max(max[i % 3], t.positions[i]);
  }
  return { min, max, span: max.map((v, i) => v - min[i]) };
}

/** Average x/z of the vertices above `y`: where the "high side" of a part is. */
function centroidAbove(t: ShapeTemplate, y: number): [number, number] {
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (let i = 0; i < t.positions.length; i += 3) {
    if (t.positions[i + 1] < y) continue;
    sx += t.positions[i];
    sz += t.positions[i + 2];
    n++;
  }
  return [sx / n, sz / n];
}

describe('part shape templates', () => {
  it.each(PART_SHAPES)('%s is a valid, bounded triangle mesh at every rotation', (shape) => {
    for (const rot of ROTATIONS) {
      const t = shapeTemplate(shape, rot);
      const vertices = t.positions.length / 3;
      expect(vertices).toBeGreaterThan(8);
      expect(vertices).toBeLessThan(600); // Cheap enough for big worlds full of parts.
      expect(t.normals.length).toBe(t.positions.length);
      expect(t.uvs.length).toBe(vertices * 2);
      expect(t.faces.length).toBe(vertices);
      expect(t.indices.length % 3).toBe(0);
      expect(Math.max(...t.indices)).toBeLessThan(vertices);
      const { min, max } = bounds(t);
      for (let a = 0; a < 3; a++) {
        expect(min[a]).toBeGreaterThanOrEqual(-1e-6);
        expect(max[a]).toBeLessThanOrEqual(1 + 1e-6);
      }
      for (const f of t.faces) expect(f).toBeLessThan(FACE_NAMES.length);
      for (const s of t.shades) expect(s).toBeGreaterThan(0.5);
    }
  });

  it('triangles face their normals (outward winding)', () => {
    for (const shape of PART_SHAPES) {
      const t = shapeTemplate(shape, 1);
      const p = t.positions;
      for (let q = 0; q < t.indices.length; q += 3) {
        const [a, b, c] = [t.indices[q], t.indices[q + 1], t.indices[q + 2]];
        const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
        const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
        const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const area = Math.hypot(cross[0], cross[1], cross[2]);
        if (area < 1e-9) continue;
        const n = [0, 1, 2].map((k) => t.normals[a * 3 + k] + t.normals[b * 3 + k] + t.normals[c * 3 + k]);
        expect(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]).toBeGreaterThan(-1e-9);
      }
    }
  });

  it('has the expected heights: slab half, plate quarter (plus studs), panes thin', () => {
    expect(bounds(shapeTemplate('slab', 0)).max[1]).toBeCloseTo(0.5);
    expect(bounds(shapeTemplate('plate', 0)).max[1]).toBeLessThan(0.36);
    expect(bounds(shapeTemplate('pane', 0)).span[2]).toBeLessThan(0.2);
    expect(bounds(shapeTemplate('pane', 0)).span[0]).toBeCloseTo(1);
    expect(isGlassLike('pane', 'pane-blue')).toBe(true);
    expect(isGlassLike('pane', 'window-glass')).toBe(true);
    expect(isGlassLike('pane', 'flag')).toBe(false);
    expect(isGlassLike('cube', 'glass')).toBe(false);
  });

  it('rotation turns the slope like content pictures: [x, z] -> [-z, x] per quarter turn', () => {
    const [x0, z0] = centroidAbove(shapeTemplate('slope', 0), 0.99);
    expect(z0).toBeCloseTo(0); // High side north at rotation 0.
    expect(x0).toBeCloseTo(0.5);
    expect(centroidAbove(shapeTemplate('slope', 1), 0.99)[0]).toBeCloseTo(1); // East.
    expect(centroidAbove(shapeTemplate('slope', 2), 0.99)[1]).toBeCloseTo(1); // South.
    expect(centroidAbove(shapeTemplate('slope', 3), 0.99)[0]).toBeCloseTo(0); // West.
  });

  it('the wheel axle follows the rotation', () => {
    // Rotation 0: axle along x, so the wheel is thinner along x than along z.
    const r0 = bounds(shapeTemplate('wheel', 0)).span;
    expect(r0[0]).toBeLessThan(r0[2]);
    const r1 = bounds(shapeTemplate('wheel', 1)).span;
    expect(r1[2]).toBeLessThan(r1[0]);
  });

  it('builds cell-centered overlay geometry with one group per face', () => {
    const g = templateToGeometry(shapeTemplate('arch', 2));
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(-0.5);
    expect(g.boundingBox!.max.y).toBeCloseTo(0.5);
    const groups = g.groups.reduce((n, gr) => n + gr.count, 0);
    expect(groups).toBe(g.index!.count);
    g.dispose();
  });
});
