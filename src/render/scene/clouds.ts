import * as THREE from 'three';
import { SIZE_X, SIZE_Z } from '../../world/grid';

const CLOUD_COUNT = 7;
const SPAN = 140;
const SPEED = 0.9;

/** A few soft puffy clouds drifting slowly across the sky, wrapping around. */
export class Clouds {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.IcosahedronGeometry(1, 2);
  private readonly material = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
  private readonly clouds: THREE.Group[] = [];

  constructor() {
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(this.geometry, this.material);
        const s = 2.2 + ((p * 37 + i * 11) % 10) / 6;
        puff.scale.set(s * 1.3, s * 0.8, s);
        puff.position.set(p * 2.6 - puffs * 1.3, ((p * 13) % 3) * 0.4, ((p * 7) % 3) * 0.8);
        cloud.add(puff);
      }
      const angle = (i / CLOUD_COUNT) * Math.PI * 2;
      cloud.position.set(
        SIZE_X / 2 + Math.cos(angle) * (30 + (i % 3) * 12) - SPAN / 2 + ((i * 53) % SPAN),
        22 + (i % 4) * 4,
        SIZE_Z / 2 + Math.sin(angle) * (30 + (i % 2) * 18),
      );
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  setColor(color: string | undefined): void {
    this.material.color.set(color ?? '#ffffff');
  }

  update(dt: number, motionScale: number): void {
    const minX = SIZE_X / 2 - SPAN / 2;
    for (const cloud of this.clouds) {
      cloud.position.x += dt * SPEED * motionScale;
      if (cloud.position.x > minX + SPAN) cloud.position.x -= SPAN;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
