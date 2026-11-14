/**
 * Small pooled effects: sparkle bursts (recenter teleport, chest opening), a tap-target
 * ring for walk taps, and floating sticker sprites. One update() per frame, no allocations
 * in the update loop except when a new sticker sprite is spawned (rare).
 */
import * as THREE from 'three';
import { drawSticker } from '../stickers';
import { geometry, material } from './shared';

const BURST_SIZE = 14;
const BURST_TIME = 0.8;
const MARKER_TIME = 0.7;
const STICKER_TIME = 2.4;

interface Spark {
  readonly mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface FloatingSticker {
  readonly sprite: THREE.Sprite;
  readonly baseY: number;
  life: number;
}

export interface Effects {
  readonly root: THREE.Group;
  burst(x: number, y: number, z: number, strength?: number): void;
  marker(x: number, y: number, z: number): void;
  sticker(id: string, x: number, y: number, z: number): void;
  /** Advances one frame; returns true while a burst, marker or sticker is still showing. */
  update(dt: number): boolean;
  dispose(): void;
}

export function createEffects(reducedMotion: () => boolean): Effects {
  const root = new THREE.Group();
  root.name = 'explore-effects';
  const sparks: Spark[] = [];
  const colors = ['#fff4b0', '#ffc2e2', '#b8f2ff', '#d6c7ff'];
  for (let i = 0; i < BURST_SIZE; i++) {
    const mesh = new THREE.Mesh(geometry('star'), material(colors[i % colors.length] as string, 0.9));
    mesh.visible = false;
    root.add(mesh);
    sparks.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
  }

  const markerMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(geometry('ring'), markerMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  root.add(ring);
  let markerLife = 0;

  const floating: FloatingSticker[] = [];

  return {
    root,
    burst(x, y, z, strength = 1) {
      const n = reducedMotion() ? 5 : BURST_SIZE;
      for (let i = 0; i < n; i++) {
        const s = sparks[i] as Spark;
        const a = (i / n) * Math.PI * 2;
        const speed = (1.2 + (i % 3) * 0.35) * strength;
        s.vx = Math.cos(a) * speed;
        s.vz = Math.sin(a) * speed;
        s.vy = 1.6 + (i % 4) * 0.4;
        s.life = BURST_TIME;
        s.mesh.position.set(x, y, z);
        s.mesh.visible = true;
      }
    },
    marker(x, y, z) {
      ring.position.set(x, y + 0.02, z);
      ring.visible = true;
      markerLife = MARKER_TIME;
    },
    sticker(id, x, y, z) {
      const tex = new THREE.CanvasTexture(drawSticker(id, 256));
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sprite.renderOrder = 10;
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(0.01);
      root.add(sprite);
      floating.push({ sprite, baseY: y, life: STICKER_TIME });
    },
    update(dt) {
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.visible = false;
          continue;
        }
        s.vy -= 4 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        s.mesh.rotation.y += dt * 6;
        s.mesh.scale.setScalar(0.07 * (s.life / BURST_TIME));
      }
      if (markerLife > 0) {
        markerLife -= dt;
        const k = 1 - markerLife / MARKER_TIME;
        ring.scale.setScalar(0.18 + 0.28 * k);
        markerMat.opacity = 0.85 * (1 - k);
        if (markerLife <= 0) ring.visible = false;
      }
      for (let i = floating.length - 1; i >= 0; i--) {
        const f = floating[i] as FloatingSticker;
        f.life -= dt;
        const k = 1 - f.life / STICKER_TIME;
        const pop = k < 0.15 ? k / 0.15 : 1;
        const size = 0.75 * (pop < 1 ? pop * (1.25 - 0.25 * pop) : 1) * (k > 0.85 ? (1 - k) / 0.15 : 1);
        f.sprite.scale.setScalar(Math.max(0.001, size));
        f.sprite.position.y = f.baseY + 1.3 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        f.sprite.material.rotation = reducedMotion() ? 0 : Math.sin(k * 12) * 0.15;
        if (f.life <= 0) {
          root.remove(f.sprite);
          f.sprite.material.map?.dispose();
          f.sprite.material.dispose();
          floating.splice(i, 1);
        }
      }
      let active = markerLife > 0 || floating.length > 0;
      for (const s of sparks) if (s.life > 0) active = true;
      return active;
    },
    dispose() {
      for (const f of floating) {
        f.sprite.material.map?.dispose();
        f.sprite.material.dispose();
      }
      floating.length = 0;
      markerMat.dispose();
      root.clear();
    },
  };
}
