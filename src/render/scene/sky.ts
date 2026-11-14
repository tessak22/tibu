import * as THREE from 'three';
import type { ThemeDef } from '../../core/types';

const SKY_RADIUS = 400;

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 topColor;
uniform vec3 bottomColor;
varying vec3 vDir;
void main() {
  float t = smoothstep(-0.55, 0.4, vDir.y);
  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
  #include <colorspace_fragment>
}`;

/** Gradient sky dome plus optional twinkly stars. Follows the camera so it is never clipped. */
export class Sky {
  readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly dome: THREE.Mesh;
  private stars: THREE.Points | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: { topColor: { value: new THREE.Color('#8fd3ff') }, bottomColor: { value: new THREE.Color('#e9f7ff') } },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), this.material);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);
  }

  setTheme(theme: ThemeDef): void {
    (this.material.uniforms.topColor.value as THREE.Color).set(theme.sky.top);
    (this.material.uniforms.bottomColor.value as THREE.Color).set(theme.sky.bottom);
    this.removeStars();
    if (theme.sky.stars) this.addStars();
  }

  follow(camera: THREE.PerspectiveCamera, time: number): void {
    this.group.position.copy(camera.position);
    // The dome itself never clips (xyww), but the stars do: keep them inside the far plane.
    this.group.scale.setScalar(Math.min(1, (camera.far * 0.85) / SKY_RADIUS));
    if (this.stars) {
      const m = this.stars.material as THREE.PointsMaterial;
      m.opacity = 0.75 + Math.sin(time * 1.3) * 0.15;
      this.stars.rotation.y = time * 0.005;
    }
  }

  dispose(): void {
    this.removeStars();
    this.dome.geometry.dispose();
    this.material.dispose();
  }

  private addStars(): void {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Deterministic spread over the upper sky.
      const u = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const v = (Math.sin(i * 78.233) * 12543.123) % 1;
      const theta = Math.abs(u) * Math.PI * 2;
      const y = 0.08 + Math.abs(v) * 0.92;
      const r = Math.sqrt(1 - y * y);
      const d = SKY_RADIUS * 0.9;
      positions.set([Math.cos(theta) * r * d, y * d, Math.sin(theta) * r * d], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: '#fffbe6',
      size: 2.6,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(geometry, material);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  private removeStars(): void {
    if (!this.stars) return;
    this.group.remove(this.stars);
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.stars = null;
  }
}
