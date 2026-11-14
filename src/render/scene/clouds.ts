import * as THREE from 'three';
import { WORLD_SIZE, type WorldSize } from '../../core/types';

const MAX_CLOUDS = 14;
const SPEED = 0.9;

/** A few soft puffy clouds drifting slowly across the sky, wrapping around. Spread to fit the world. */
export class Clouds {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.IcosahedronGeometry(1, 2);
  private readonly material = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
  private readonly clouds: THREE.Group[] = [];
  private minX = 0;
  private span = 140;

  constructor() {
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(this.geometry, this.material);
        const s = 2.2 + ((p * 37 + i * 11) % 10) / 6;
        puff.scale.set(s * 1.3, s * 0.8, s);
        puff.position.set(p * 2.6 - puffs * 1.3, ((p * 13) % 3) * 0.4, ((p * 7) % 3) * 0.8);
        cloud.add(puff);
      }
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
    this.layout(WORLD_SIZE);
  }

  /** Re-spreads the clouds around a world of this size (more clouds for bigger worlds). */
  layout(size: WorldSize): void {
    const big = Math.max(size.x, size.z) > 32;
    const count = big ? MAX_CLOUDS : 7;
    const reach = Math.max(size.x, size.z) / 2;
    this.span = Math.max(140, reach * 2 + 80);
    const cx = size.x / 2;
    const cz = size.z / 2;
    this.minX = cx - this.span / 2;
    this.clouds.forEach((cloud, i) => {
      cloud.visible = i < count;
      const angle = (i / count) * Math.PI * 2;
      // Big worlds: clouds drift around the rim of the map, never over the middle of the view.
      const ring = big ? reach * (1.05 + (i % 3) * 0.2) : 30 + (i % 3) * 12;
      cloud.position.set(
        cx + Math.cos(angle) * ring + (big ? 0 : ((i * 53) % this.span) - this.span / 2),
        (big ? size.y + 10 : size.y + 6) + (i % 4) * 4,
        cz + Math.sin(angle) * (big ? ring : 30 + (i % 2) * 18),
      );
      cloud.position.x = this.minX + ((((cloud.position.x - this.minX) % this.span) + this.span) % this.span);
    });
  }

  setColor(color: string | undefined): void {
    this.material.color.set(color ?? '#ffffff');
  }

  update(dt: number, motionScale: number): void {
    for (const cloud of this.clouds) {
      cloud.position.x += dt * SPEED * motionScale;
      if (cloud.position.x > this.minX + this.span) cloud.position.x -= this.span;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
