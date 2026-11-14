import * as THREE from 'three';
import type {
  BlockKey,
  Cell,
  ContentRegistry,
  GameView,
  Mode,
  ThemeDef,
  WorldAction,
  WorldModel,
} from '../core/types';
import { attachInput } from '../input/attachInput';
import { GALLERY_ORBIT } from '../input/orbit';
import { CameraController } from './cameraController';
import { ViewEmitter } from './emitter';
import { createInteraction } from './interaction';
import { QualityMonitor } from './quality';
import { ISLAND_CENTER } from './scene/lights';
import { SceneGraph } from './sceneGraph';
import { FramePacer } from './framePacer';
import { createSnapshotter } from './snapshot';
import { installTestHook } from './testHook';

const MAX_PIXEL_RATIO = 2;
const MAX_FRAME_DT = 0.1;

const cellCenter = (c: Cell): THREE.Vector3 => new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5);

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The sun and its shadow camera are fixed, so the shadow map only changes with the blocks.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  return renderer;
}

/** Rendering + touch input on one canvas. See GameView in core/types.ts for the contract. */
export function createGameView(canvas: HTMLCanvasElement, registry: ContentRegistry): GameView {
  const renderer = createRenderer(canvas);
  const graph = new SceneGraph(registry, renderer.capabilities.getMaxAnisotropy());
  const cameraCtl = new CameraController();
  const emitter = new ViewEmitter();
  const quality = new QualityMonitor();
  const clock = new THREE.Timer();
  const pacer = new FramePacer();
  const snapshotter = createSnapshotter();

  let world: WorldModel | null = null;
  let unsubscribeWorld: () => void = () => undefined;
  let mode: Mode = 'build';
  let selected: BlockKey | null = null;
  let reducedMotion = false;
  let active = true;
  let disposed = false;
  let frameHandle = 0;
  let time = 0;
  /** Something besides the clouds moved last frame: keep full frame rate. */
  let animating = true;

  const invalidateShadows = (): void => {
    renderer.shadowMap.needsUpdate = true;
  };
  const rebuildChunks = (): void => {
    if (graph.chunks.update()) invalidateShadows();
  };

  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(w, h, false);
    cameraCtl.setAspect(w / h);
  };
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', resize);
  resize();

  const onWorldChange = (change: WorldAction, cause: 'action' | 'undo'): void => {
    graph.mirror.apply(change);
    graph.chunks.markCell(change.cell);
    graph.glow.markDirty();
    if (change.type === 'remove') {
      // Smashed or undone while still bouncing: drop the overlay so no ghost block lingers.
      graph.bounce.cancel(change.cell);
      graph.particles.pop(cellCenter(change.cell), graph.looks.averageColor(change.block));
      if (cause === 'action') graph.highlight.hide();
    } else {
      graph.bounce.start(change.cell, change.block, true);
    }
    requestFrame();
  };

  const detachInput = attachInput(
    canvas,
    createInteraction(canvas, graph, cameraCtl, emitter, () => ({ world, mode, selected }), requestFrame),
  );

  const removeTestHook = installTestHook({
    worldCount: () => world?.count() ?? 0,
    getBlock: (x, y, z) => world?.get({ x, y, z }) ?? null,
    cellToScreen: (x, y, z) => {
      const p = new THREE.Vector3(x + 0.5, y + 1, z + 0.5).project(cameraCtl.camera);
      if (p.z > 1) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    },
  });

  /** `measure`: the frame time is a fair device-speed sample (not a throttled idle frame). */
  function step(dt: number, measure: boolean): void {
    time += dt;
    if (measure && quality.frame(dt)) {
      graph.setLowQuality(true, reducedMotion);
      invalidateShadows();
    }
    const cameraMoving = cameraCtl.update(dt);
    graph.clouds.update(dt, reducedMotion ? 0.4 : 1);
    graph.particles.update(dt);
    graph.bounce.update(dt);
    graph.highlight.update(dt, reducedMotion);
    graph.dim.update(dt, reducedMotion);
    graph.glow.update(dt, cameraCtl.camera);
    rebuildChunks();
    // The bouncing overlay cube casts a shadow.
    if (graph.bounce.isAnimating()) invalidateShadows();
    graph.atlas.flush();
    graph.sky.follow(cameraCtl.camera, time);
    animating =
      cameraMoving ||
      graph.particles.isAnimating() ||
      graph.bounce.isAnimating() ||
      graph.highlight.isAnimating() ||
      graph.dim.isFading();
  }

  function frame(now: number): void {
    frameHandle = 0;
    if (disposed || !active) return;
    const paced = pacer.next(now, animating);
    if (paced) {
      clock.update();
      step(Math.min(MAX_FRAME_DT, clock.getDelta()), paced.measure);
      renderer.render(graph.scene, cameraCtl.camera);
    }
    frameHandle = requestAnimationFrame(frame);
  }

  /** Input, world changes and effects call this: render now and stay smooth for a moment. */
  function requestFrame(): void {
    pacer.kick(performance.now());
    if (!disposed && active && frameHandle === 0) frameHandle = requestAnimationFrame(frame);
  }

  const view: GameView = {
    setWorld(next: WorldModel, theme: ThemeDef) {
      unsubscribeWorld();
      world = next;
      graph.mirror.load(next);
      graph.setTheme(theme);
      graph.chunks.markAll();
      graph.glow.markDirty();
      graph.highlight.hide();
      unsubscribeWorld = next.onChange(onWorldChange);
      rebuildChunks();
      invalidateShadows();
      requestFrame();
    },
    setMode(next) {
      mode = next;
      graph.highlight.setMode(next);
      graph.highlight.hide();
    },
    setSelectedBlock(block) {
      selected = block;
      graph.highlight.setSelected(block);
    },
    resetCamera() {
      cameraCtl.reset(reducedMotion);
      requestFrame();
    },
    setReducedMotion(on) {
      reducedMotion = on;
      graph.setParticleDensity(quality.isLow(), on);
    },
    setDimmed(on) {
      graph.dim.set(on);
      requestFrame();
    },
    confetti(at?: Cell) {
      const center = at ? cellCenter(at) : ISLAND_CENTER.clone().add(new THREE.Vector3(0, 4, 0));
      graph.particles.confetti(center);
      requestFrame();
    },
    bounce(cell) {
      const block = world?.get(cell);
      if (block) graph.bounce.start(cell, block, reducedMotion);
      requestFrame();
    },
    async snapshot({ width, height, galleryAngle }) {
      rebuildChunks();
      graph.atlas.flush();
      const camera = cameraCtl.camera.clone();
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      if (galleryAngle) CameraController.place(camera, GALLERY_ORBIT);
      camera.updateProjectionMatrix();
      graph.sky.follow(camera, time);
      const highlightWasVisible = graph.highlight.group.visible;
      const dimWasVisible = graph.dim.mesh.visible;
      graph.highlight.group.visible = false;
      graph.dim.mesh.visible = false;
      try {
        return await snapshotter.render(renderer, graph.scene, camera, width, height);
      } finally {
        graph.highlight.group.visible = highlightWasVisible;
        graph.dim.mesh.visible = dimWasVisible;
        graph.sky.follow(cameraCtl.camera, time);
      }
    },
    on(event, listener) {
      return emitter.on(event, listener);
    },
    setActive(next) {
      if (active === next) return;
      active = next;
      if (next) {
        clock.reset();
        invalidateShadows();
        requestFrame();
      } else if (frameHandle) {
        cancelAnimationFrame(frameHandle);
        frameHandle = 0;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      unsubscribeWorld();
      detachInput();
      removeTestHook();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      emitter.clear();
      snapshotter.dispose();
      graph.dispose();
      clock.dispose();
      renderer.dispose();
    },
  };
  return view;
}
