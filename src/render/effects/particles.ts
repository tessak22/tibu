import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const CAPACITY = 220;
const GRAVITY = -14;

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  size: number;
  gravity: number;
  drag: number;
}

const CONFETTI_COLORS = ['#ff8fab', '#ffd166', '#8bd3ff', '#9ef0b0', '#c3a6ff', '#ffb38a'];

/** Instanced, pooled particles for smash pops and confetti. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly particles: Particle[];
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private cursor = 0;
  /** 1 = full effects, lower = fewer particles (low quality or reduced motion). */
  density = 1;

  constructor() {
    const geometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.22);
    const material = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    this.mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    this.mesh.name = 'particles';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particles = Array.from({ length: CAPACITY }, () => ({
      alive: false,
      life: 0,
      maxLife: 1,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      spin: new THREE.Vector3(),
      size: 0.2,
      gravity: GRAVITY,
      drag: 0,
    }));
    for (let i = 0; i < CAPACITY; i++) this.mesh.setColorAt(i, this.color.set('#ffffff'));
  }

  /** A soft pop of chunky bits from a smashed block. */
  pop(center: THREE.Vector3, color: THREE.Color): void {
    const n = Math.max(4, Math.round(16 * this.density));
    for (let i = 0; i < n; i++) {
      const tint = this.color.copy(color).offsetHSL(0, 0, (Math.random() - 0.3) * 0.15);
      this.spawn(tint, (p) => {
        p.pos.set(center.x + (Math.random() - 0.5) * 0.6, center.y + (Math.random() - 0.5) * 0.6, center.z + (Math.random() - 0.5) * 0.6);
        p.vel.set((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6);
        p.size = 0.16 + Math.random() * 0.16;
        p.maxLife = 0.7 + Math.random() * 0.35;
        p.gravity = GRAVITY;
        p.drag = 0.6;
      });
    }
  }

  /** Celebratory confetti raining around a point. */
  confetti(center: THREE.Vector3): void {
    const n = Math.max(12, Math.round(110 * this.density));
    for (let i = 0; i < n; i++) {
      this.color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      this.spawn(this.color, (p) => {
        p.pos.set(center.x + (Math.random() - 0.5) * 3, center.y + Math.random() * 2, center.z + (Math.random() - 0.5) * 3);
        p.vel.set((Math.random() - 0.5) * 9, 6 + Math.random() * 7, (Math.random() - 0.5) * 9);
        p.size = 0.24 + Math.random() * 0.16;
        p.maxLife = 1.8 + Math.random() * 1.2;
        p.gravity = -6;
        p.drag = 1.6;
      });
    }
  }

  update(dt: number): void {
    let maxIndex = -1;
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const fade = 1 - Math.max(0, (p.life - p.maxLife * 0.6) / (p.maxLife * 0.4));
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.copy(p.rot);
      this.dummy.scale.set(p.size, p.size * (p.gravity > -10 ? 0.25 : 1), p.size).multiplyScalar(fade);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      maxIndex = i;
    }
    this.mesh.count = maxIndex + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }

  private spawn(color: THREE.Color, init: (p: Particle) => void): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % CAPACITY;
    const p = this.particles[i];
    p.alive = true;
    p.life = 0;
    p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.spin.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    init(p);
    this.mesh.setColorAt(i, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
