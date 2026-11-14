import * as THREE from 'three';
import type { BlockKey, Cell, ContentRegistry, GameView, Mode, ThemeDef, WorldModel, WorldSize } from '../core/types';
import { attachInput } from '../input/attachInput';
import { galleryOrbitFor, isBigWorld, rotationFromYaw } from '../input/orbit';
import { CameraController, viewRangeFor } from './cameraController';
import { ViewEmitter } from './emitter';
import { FramePacer } from './framePacer';
import { createInteraction } from './interaction';
import { QualityMonitor } from './quality';
import { SceneGraph } from './sceneGraph';
import { createSnapshotter } from './snapshot';
import { installTestHook } from './testHook';
import { createWorldSync } from './worldSync';

type FrameCallback = (dt: number) => boolean | void;

const MAX_PIXEL_RATIO = 2;
const MAX_FRAME_DT = 0.1;

const cellCenter = (c: Cell): THREE.Vector3 => new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5);
const sameSize = (a: WorldSize, b: WorldSize): boolean => a.x === b.x && a.y === b.y && a.z === b.z;

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The shadow map only re-renders when blocks change, the sun moves or actors walk.
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
  /** Copy-on-write: (un)subscribing swaps the array, so a frame iterates a stable snapshot. */
  let frameCallbacks: readonly FrameCallback[] = [];

  let world: WorldModel | null = null;
  let unsubscribeWorld: () => void = () => undefined;
  let mode: Mode = 'build';
  let selected: BlockKey | null = null;
  let topple = true;
  let reducedMotion = false;
  let active = true;
  let disposed = false;
  let frameHandle = 0;
  let time = 0;
  let smashOrigin: Cell | null = null;
  let shadowTick = false;
  /** Something besides the clouds moved last frame: keep full frame rate. */
  let animating = true;

  const invalidateShadows = (): void => {
    renderer.shadowMap.needsUpdate = true;
  };
  const rebuildChunks = (force = false): void => {
    if (graph.chunks.update(cameraCtl.focus, force)) invalidateShadows();
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

  const onWorldChange = createWorldSync(graph, {
    reducedMotion: () => reducedMotion,
    smashOrigin: () => smashOrigin,
    requestFrame,
  });

  const placementRotation = () => rotationFromYaw(cameraCtl.orbit.azimuth);

  const detachInput = attachInput(
    canvas,
    createInteraction(canvas, graph, cameraCtl, emitter, {
      getState: () => ({ world, mode, selected, topple, reducedMotion }),
      onUserInput: requestFrame,
      placementRotation,
      setSmashOrigin: (cell) => {
        smashOrigin = cell;
      },
    }),
  );

  const removeTestHook = installTestHook({
    worldCount: () => world?.count() ?? 0,
    getBlock: (x, y, z) => world?.get({ x, y, z }) ?? null,
    cellToScreen: (x, y, z) => {
      const p = new THREE.Vector3(x + 0.5, y + 1, z + 0.5).project(cameraCtl.camera);
      if (p.z > 1 || p.z < -1) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    },
    ghostCount: () => graph.ghosts.count(),
    worldSize: () => ({ ...graph.mirror.size }),
    pendingChunks: () => graph.chunks.pendingCount(),
  });

  /** Runs every callback; true when any of them reports something moving. */
  function runFrameCallbacks(dt: number): boolean {
    const callbacks = frameCallbacks;
    let moving = false;
    for (let i = 0; i < callbacks.length; i++) {
      try {
        if ((callbacks[i] as FrameCallback)(dt) === true) moving = true;
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
    return moving;
  }

  /** Big worlds: fog, far plane, chunk distance culling and the sun all follow the view. */
  function followView(): void {
    const size = graph.mirror.size;
    const range = viewRangeFor(size, cameraCtl.orbit.radius);
    graph.setFogRange(range.fogNear, range.fogFar);
    if (!isBigWorld(size)) return;
    graph.chunks.cull(cameraCtl.camera.position, range.fogFar);
    if (graph.lights.follow(cameraCtl.focus)) invalidateShadows();
  }

  /** `measure`: the frame time is a fair device-speed sample (not a throttled idle frame). */
  function step(dt: number, measure: boolean): void {
    time += dt;
    if (measure && quality.frame(dt)) {
      graph.setLowQuality(true, reducedMotion);
      invalidateShadows();
    }
    const actorsMoving = runFrameCallbacks(dt);
    const cameraMoving = cameraCtl.update(dt);
    followView();
    graph.clouds.update(dt, reducedMotion ? 0.4 : 1);
    graph.particles.update(dt);
    graph.bounce.update(dt);
    graph.collapse.update(dt);
    graph.ghosts.update(dt, reducedMotion, (c) => graph.mirror.isSolid(c.x, c.y, c.z));
    graph.walkMarker.update(dt);
    graph.highlight.update(dt, reducedMotion);
    graph.dim.update(dt, reducedMotion);
    graph.glow.update(dt, cameraCtl.camera);
    rebuildChunks();
    // The bouncing overlay casts a shadow; walking actors refresh theirs at half rate.
    if (graph.bounce.isAnimating()) invalidateShadows();
    shadowTick = actorsMoving && graph.actors.count() > 0 && !shadowTick;
    if (shadowTick) invalidateShadows();
    graph.atlas.flush();
    graph.sky.follow(cameraCtl.camera, time);
    animating =
      cameraMoving ||
      actorsMoving ||
      graph.chunks.pendingCount() > 0 ||
      graph.particles.isAnimating() ||
      graph.bounce.isAnimating() ||
      graph.collapse.isAnimating() ||
      graph.walkMarker.isAnimating() ||
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

  async function snapshot(width: number, height: number, galleryAngle: boolean): Promise<Blob> {
    rebuildChunks(true);
    graph.atlas.flush();
    const size = graph.mirror.size;
    const camera = cameraCtl.camera.clone();
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    if (galleryAngle) {
      const orbit = galleryOrbitFor(size);
      const range = viewRangeFor(size, orbit.radius);
      camera.far = Math.max(range.far, orbit.radius * 2.5);
      graph.setFogRange(Math.max(range.fogNear, orbit.radius * 1.2), Math.max(range.fogFar, orbit.radius * 2.2));
      graph.chunks.cull(camera.position, Number.POSITIVE_INFINITY);
      CameraController.place(camera, orbit, cameraCtl.galleryTarget());
    }
    camera.updateProjectionMatrix();
    graph.sky.follow(camera, time);
    const hidden = [graph.highlight.group, graph.dim.mesh, graph.ghosts.group, graph.walkMarker.group];
    // From the high gallery angle of a big world, clouds would hide the islands.
    if (galleryAngle && isBigWorld(size)) hidden.push(graph.clouds.group);
    const wasVisible = hidden.map((o) => o.visible);
    for (const o of hidden) o.visible = false;
    invalidateShadows();
    try {
      return await snapshotter.render(renderer, graph.scene, camera, width, height);
    } finally {
      hidden.forEach((o, i) => (o.visible = wasVisible[i]));
      graph.sky.follow(cameraCtl.camera, time);
      followView();
      invalidateShadows();
      requestFrame();
    }
  }

  const view: GameView = {
    setWorld(next: WorldModel, theme: ThemeDef) {
      unsubscribeWorld();
      world = next;
      const sizeChanged = !sameSize(next.size, graph.mirror.size);
      graph.load(next, theme);
      if (sizeChanged || isBigWorld(next.size)) cameraCtl.setWorldSize(next.size);
      graph.highlight.hide();
      graph.ghosts.set(null);
      graph.glow.markDirty();
      unsubscribeWorld = next.onChange(onWorldChange);
      followView();
      rebuildChunks();
      invalidateShadows();
      requestFrame();
    },
    setMode(next) {
      mode = next;
      graph.highlight.setMode(next);
      graph.highlight.hide();
      graph.ghosts.setHovered(null);
    },
    setSelectedBlock(block) {
      selected = block;
      graph.highlight.setSelected(block);
    },
    setTopple(on) {
      topple = on;
    },
    placementRotation,
    setGhosts(ghosts) {
      graph.ghosts.set(ghosts);
      requestFrame();
    },
    addActor(object, options) {
      const remove = graph.actors.add(object, options);
      invalidateShadows();
      requestFrame();
      return () => {
        remove();
        invalidateShadows();
        requestFrame();
      };
    },
    setFollowTarget(object) {
      cameraCtl.setFollow(object);
      requestFrame();
    },
    followTarget() {
      return cameraCtl.followTarget();
    },
    onFrame(callback) {
      // Wrap so the same function can subscribe twice and unsubscribe exactly once each.
      const entry: FrameCallback = (dt) => callback(dt);
      frameCallbacks = [...frameCallbacks, entry];
      requestFrame();
      return () => {
        frameCallbacks = frameCallbacks.filter((cb) => cb !== entry);
      };
    },
    cellCenter(cell) {
      return { x: cell.x + 0.5, y: cell.y + 0.5, z: cell.z + 0.5 };
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
      graph.particles.confetti(at ? cellCenter(at) : new THREE.Vector3(0, 4, 0).add(cameraCtl.focus));
      requestFrame();
    },
    bounce(cell) {
      const block = world?.get(cell);
      if (block) graph.bounce.start(cell, block, reducedMotion, graph.mirror.rotation(cell));
      requestFrame();
    },
    snapshot({ width, height, galleryAngle }) {
      return snapshot(width, height, Boolean(galleryAngle));
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
      frameCallbacks = [];
      cameraCtl.setFollow(null);
      snapshotter.dispose();
      graph.dispose();
      clock.dispose();
      renderer.dispose();
    },
  };
  return view;
}
