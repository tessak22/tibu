import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BIG_WORLD_SIZE } from '../../../src/core/types';
import { FOLLOW_POLAR, FOLLOW_RADIUS, followOrbitFor } from '../../../src/input/orbit';
import { CameraController } from '../../../src/render/cameraController';

/** A follow camera on a big world, settled on a buddy standing at (40, 4, 40). */
function settled(): { cam: CameraController; buddy: THREE.Object3D } {
  const cam = new CameraController();
  cam.setWorldSize(BIG_WORLD_SIZE);
  cam.setAspect(1180 / 820);
  const buddy = new THREE.Object3D();
  buddy.position.set(40.5, 4, 40.5);
  cam.setFollow(buddy);
  for (let i = 0; i < 300; i++) cam.update(1 / 60);
  return { cam, buddy };
}

describe('camera follow', () => {
  it('glides into the close third-person framing', () => {
    const { cam } = settled();
    expect(cam.orbit.radius).toBeCloseTo(FOLLOW_RADIUS);
    expect(cam.orbit.polar).toBeCloseTo(FOLLOW_POLAR);
    expect(cam.followTarget()).not.toBeNull();
  });

  it('counts as moving only while converging', () => {
    const { cam, buddy } = settled();
    expect(cam.update(1 / 60)).toBe(false);
    buddy.position.x += 3;
    expect(cam.update(1 / 60)).toBe(true);
    let frames = 0;
    while (cam.update(1 / 60) && frames < 600) frames++;
    expect(frames).toBeLessThan(600);
    expect(cam.update(1 / 60)).toBe(false);
    expect(cam.focus.x).toBeCloseTo(buddy.position.x, 5);
  });

  it('frames the buddy at about 1/8 of a 1180x820 screen', () => {
    const { cam, buddy } = settled();
    const feet = buddy.position.clone().project(cam.camera);
    const head = buddy.position.clone().add(new THREE.Vector3(0, 0.82, 0)).project(cam.camera);
    const fraction = Math.abs(head.y - feet.y) / 2;
    expect(fraction).toBeGreaterThan(1 / 10);
    expect(fraction).toBeLessThan(1 / 6.5);
    // Camera sits above the buddy, looking down a little.
    expect(cam.camera.position.y).toBeGreaterThan(buddy.position.y + 2);
  });

  it('pinch zooms out and back in, and reset returns to the follow framing', () => {
    const { cam } = settled();
    cam.zoom(0.4);
    expect(cam.orbit.radius).toBeGreaterThan(FOLLOW_RADIUS * 2);
    cam.zoom(2.5);
    expect(cam.orbit.radius).toBeCloseTo(FOLLOW_RADIUS, 1);
    cam.zoom(0.3);
    cam.reset(true);
    expect(cam.orbit.radius).toBeCloseTo(FOLLOW_RADIUS);
    expect(cam.orbit.polar).toBeCloseTo(FOLLOW_POLAR);
  });

  it('keeps the child orbit direction in the follow framing', () => {
    expect(followOrbitFor(1.2).azimuth).toBe(1.2);
    expect(followOrbitFor(Number.NaN).azimuth).toBeCloseTo(Math.PI / 4);
  });

  it('focus is the live target, not a per-frame copy', () => {
    const { cam } = settled();
    expect(cam.focus).toBe(cam.focus);
  });
});
