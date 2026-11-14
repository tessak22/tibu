import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shouldReleaseFollow } from '../../../src/explore/index';
import { acquireShared, geometry, sharedCount, sharedUsers } from '../../../src/explore/three/shared';

describe('shared explore resources', () => {
  it('stay alive until the last explorer releases them', () => {
    const releaseOld = acquireShared();
    const sphere = geometry('sphere');
    const releaseNew = acquireShared(); // a new explorer starts before the old one is disposed
    releaseOld();
    expect(geometry('sphere')).toBe(sphere);
    expect(sharedCount()).toBeGreaterThan(0);
    releaseNew();
    expect(sharedUsers()).toBe(0);
    expect(sharedCount()).toBe(0);
  });

  it('ignores a double release', () => {
    const a = acquireShared();
    const b = acquireShared();
    a();
    a();
    expect(sharedUsers()).toBe(1);
    b();
    expect(sharedUsers()).toBe(0);
  });
});

describe('shouldReleaseFollow', () => {
  const mine = new THREE.Object3D();
  const other = new THREE.Object3D();

  it('clears the follow target only while it is still our buddy', () => {
    expect(shouldReleaseFollow({ followTarget: () => mine }, mine, true)).toBe(true);
    expect(shouldReleaseFollow({ followTarget: () => other }, mine, true)).toBe(false);
    expect(shouldReleaseFollow({ followTarget: () => null }, mine, true)).toBe(false);
  });

  it('falls back to "we set it" for views without followTarget()', () => {
    expect(shouldReleaseFollow({}, mine, true)).toBe(true);
    expect(shouldReleaseFollow({}, mine, false)).toBe(false);
  });
});
