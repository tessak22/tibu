import * as THREE from 'three';

const TARGET_OPACITY = 0.5;
const FADE_SECONDS = 2.5;

/** A gentle, slow twilight fade over the whole view (play timer ending). */
export class DimOverlay {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private target = 0;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: '#2b2550',
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.renderOrder = 1000;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // Positioned in clip space by the vertex shader below so it always covers the view.
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        'vec4 mvPosition = vec4(position, 1.0); gl_Position = vec4(position.xy, 0.0, 1.0);',
      );
    };
  }

  set(on: boolean): void {
    this.target = on ? TARGET_OPACITY : 0;
  }

  update(dt: number, instant: boolean): void {
    const step = instant ? 1 : dt / FADE_SECONDS;
    const o = this.material.opacity;
    const next = o < this.target ? Math.min(this.target, o + step) : Math.max(this.target, o - step);
    this.material.opacity = next;
    this.mesh.visible = next > 0.001;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
