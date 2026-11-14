import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE } from '../../../src/core/types';
import { ChunkLayout } from '../../../src/render/chunkMath';
import { outlineGeometry, outlineSegments } from '../../../src/render/effects/ghostOutline';
import { templateToGeometry } from '../../../src/render/shapeGeometry';
import { shapeTemplate } from '../../../src/render/shapes';

describe('chunk centers', () => {
  it('centerX/centerZ match center() without allocating objects', () => {
    const layout = new ChunkLayout(BIG_WORLD_SIZE);
    for (let i = 0; i < layout.count; i++) {
      const c = layout.center(i);
      expect(layout.centerX(i)).toBe(c.x);
      expect(layout.centerZ(i)).toBe(c.z);
    }
  });
});

describe('ghost outline', () => {
  it('outlines a cube with its 12 edges', () => {
    expect(outlineSegments(new THREE.BoxGeometry(1, 1, 1))).toHaveLength(12);
  });

  it('outlines a part by its real shape (a cylinder gets round rims, not a box)', () => {
    const cylinder = templateToGeometry(shapeTemplate('cylinder', 0));
    const segments = outlineSegments(cylinder);
    expect(segments.length).toBeGreaterThan(12);
    for (const s of segments) {
      // Every outline point lies on the cylinder (radius 0.45 around the cell center).
      expect(Math.hypot(s[0] as number, s[2] as number)).toBeLessThan(0.46);
    }
  });

  it('builds solid bars (one box per edge)', () => {
    const bars = outlineGeometry(new THREE.BoxGeometry(1, 1, 1), 0.05);
    expect(bars.getAttribute('position').count).toBe(12 * 24);
    bars.computeBoundingBox();
    expect(bars.boundingBox?.max.x).toBeCloseTo(0.525);
  });
});
