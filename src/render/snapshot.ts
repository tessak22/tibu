import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const MAX_SNAPSHOT_SIDE = 4096;

/**
 * Renders a scene offscreen and returns a PNG. The scene is rendered to a linear HDR target,
 * then an OutputPass applies tone mapping and sRGB conversion exactly like on-screen output.
 * Works while the view is inactive and never touches the visible canvas.
 */
export async function renderSnapshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): Promise<Blob> {
  const w = Math.max(1, Math.min(MAX_SNAPSHOT_SIDE, Math.round(width)));
  const h = Math.max(1, Math.min(MAX_SNAPSHOT_SIDE, Math.round(height)));
  const sceneTarget = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const outputTarget = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType });
  const output = new OutputPass();
  const previousTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);
    output.render(renderer, outputTarget, sceneTarget, 0, false);
    const pixels = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(outputTarget, 0, 0, w, h, pixels);
    return await pixelsToPng(pixels, w, h);
  } finally {
    renderer.setRenderTarget(previousTarget);
    sceneTarget.dispose();
    outputTarget.dispose();
    output.dispose();
  }
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
