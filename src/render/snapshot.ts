import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const MAX_SNAPSHOT_SIDE = 4096;

export interface Snapshotter {
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ): Promise<Blob>;
  dispose(): void;
}

/**
 * Renders a scene offscreen and returns a PNG. The scene is rendered to a linear HDR target,
 * then an OutputPass applies tone mapping and sRGB conversion exactly like on-screen output.
 * Works while the view is inactive and never touches the visible canvas. The render targets and
 * pass are created once and resized only when a different size is asked for.
 */
export function createSnapshotter(): Snapshotter {
  let sceneTarget: THREE.WebGLRenderTarget | null = null;
  let outputTarget: THREE.WebGLRenderTarget | null = null;
  let output: OutputPass | null = null;

  const targetsFor = (w: number, h: number) => {
    sceneTarget ??= new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    outputTarget ??= new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType });
    output ??= new OutputPass();
    if (sceneTarget.width !== w || sceneTarget.height !== h) sceneTarget.setSize(w, h);
    if (outputTarget.width !== w || outputTarget.height !== h) outputTarget.setSize(w, h);
    return { scene: sceneTarget, out: outputTarget, pass: output };
  };

  return {
    async render(renderer, scene, camera, width, height) {
      const w = Math.max(1, Math.min(MAX_SNAPSHOT_SIDE, Math.round(width)));
      const h = Math.max(1, Math.min(MAX_SNAPSHOT_SIDE, Math.round(height)));
      const targets = targetsFor(w, h);
      const previousTarget = renderer.getRenderTarget();
      const pixels = new Uint8Array(w * h * 4);
      try {
        renderer.setRenderTarget(targets.scene);
        renderer.clear();
        renderer.render(scene, camera);
        targets.pass.render(renderer, targets.out, targets.scene, 0, false);
        renderer.readRenderTargetPixels(targets.out, 0, 0, w, h, pixels);
      } finally {
        renderer.setRenderTarget(previousTarget);
      }
      return pixelsToPng(pixels, w, h);
    },
    dispose() {
      sceneTarget?.dispose();
      outputTarget?.dispose();
      output?.dispose();
      sceneTarget = null;
      outputTarget = null;
      output = null;
    },
  };
}

function pixelsToPng(pixels: Uint8Array, w: number, h: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Tibu: 2D canvas unavailable for snapshot'));
  const image = ctx.createImageData(w, h);
  const row = w * 4;
  // WebGL rows are bottom-up; flip into the image.
  for (let y = 0; y < h; y++) image.data.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Tibu: snapshot encoding failed'))), 'image/png');
  });
}
