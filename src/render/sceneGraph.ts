import * as THREE from 'three';
import type { ContentRegistry, ThemeDef, WorldModel } from '../core/types';
import { isBigWorld } from '../input/orbit';
import { Actors } from './actors';
import { TextureAtlas } from './atlas';
import { BlockLooks } from './blockLook';
import { ChunkRenderer } from './chunks';
import { BounceEffects } from './effects/bounce';
import { CollapseEffects } from './effects/collapse';
import { DimOverlay } from './effects/dim';
import { Ghosts } from './effects/ghosts';
import { GlowLights } from './effects/glowLights';
import { Highlight } from './effects/highlight';
import { Particles } from './effects/particles';
import { WalkMarker } from './effects/walkMarker';
import { Clouds } from './scene/clouds';
import { IslandUnderside } from './scene/island';
import { Lights } from './scene/lights';
import { Sky } from './scene/sky';
import { ShapeGeometries } from './shapeGeometry';
import { VoxelMirror } from './voxelMirror';

/** Everything that lives in the 3D scene, created and disposed together. */
export class SceneGraph {
  readonly scene = new THREE.Scene();
  readonly mirror = new VoxelMirror();
  readonly looks: BlockLooks;
  readonly atlas: TextureAtlas;
  readonly geometries = new ShapeGeometries();
  readonly chunks: ChunkRenderer;
  readonly sky = new Sky();
  readonly lights = new Lights();
  readonly clouds = new Clouds();
  readonly underside = new IslandUnderside();
  readonly particles = new Particles();
  readonly bounce: BounceEffects;
  readonly highlight: Highlight;
  readonly ghosts: Ghosts;
  readonly collapse: CollapseEffects;
  readonly walkMarker = new WalkMarker();
  readonly actors = new Actors();
  readonly dim = new DimOverlay();
  readonly glow: GlowLights;
  readonly fog = new THREE.Fog(new THREE.Color('#e9f7ff'), 90, 260);

  constructor(registry: ContentRegistry, maxAnisotropy: number) {
    this.looks = new BlockLooks(registry);
    this.atlas = new TextureAtlas(maxAnisotropy);
    this.chunks = new ChunkRenderer(this.mirror, this.atlas, this.looks);
    this.bounce = new BounceEffects(this.looks, this.geometries, (cell, hidden) => this.chunks.setHidden(cell, hidden));
    this.highlight = new Highlight(this.looks, this.geometries);
    this.ghosts = new Ghosts(this.looks, this.geometries);
    this.collapse = new CollapseEffects(this.looks, this.geometries, (center, block) =>
      this.particles.pop(center, this.looks.averageColor(block)),
    );
    this.glow = new GlowLights(this.mirror, this.looks);
    this.scene.fog = this.fog;
    this.scene.add(
      this.sky.group,
      this.lights.group,
      this.clouds.group,
      this.underside.group,
      this.chunks.group,
      this.actors.group,
      this.collapse.group,
      this.particles.mesh,
      this.bounce.group,
      this.ghosts.group,
      this.walkMarker.group,
      this.highlight.group,
      this.glow.group,
      this.dim.mesh,
    );
  }

  /** Loads a world: mirror, chunk layout, island rock, clouds and sun all follow its size. */
  load(world: WorldModel, theme: ThemeDef): void {
    this.mirror.load(world);
    const size = this.mirror.size;
    this.chunks.setSize(size);
    this.chunks.markAll();
    this.lights.setWorldSize(size);
    this.clouds.layout(size);
    this.setTheme(theme);
    this.underside.build(theme, this.mirror.floorMask(), size);
  }

  setTheme(theme: ThemeDef): void {
    this.sky.setTheme(theme);
    this.lights.setSkyTint(theme.sky.top);
    this.clouds.setColor(theme.cloudColor);
    // Fog fades into the bottom of the sky gradient, so the world edge melts into the horizon.
    this.fog.color.set(theme.sky.bottom);
  }

  setFogRange(near: number, far: number): void {
    this.fog.near = near;
    this.fog.far = far;
  }

  isBig(): boolean {
    return isBigWorld(this.mirror.size);
  }

  setLowQuality(low: boolean, reducedMotion: boolean): void {
    this.lights.setShadows(!low);
    this.chunks.setShadows(!low);
    this.glow.setLimit(low ? 2 : 4);
    this.setParticleDensity(low, reducedMotion);
  }

  setParticleDensity(low: boolean, reducedMotion: boolean): void {
    this.particles.density = reducedMotion ? 0.3 : low ? 0.45 : 1;
  }

  dispose(): void {
    this.bounce.dispose();
    this.collapse.dispose();
    this.ghosts.dispose();
    this.walkMarker.dispose();
    this.actors.clear();
    this.chunks.dispose();
    this.geometries.dispose();
    this.atlas.dispose();
    this.looks.dispose();
    this.sky.dispose();
    this.lights.dispose();
    this.clouds.dispose();
    this.underside.dispose();
    this.particles.dispose();
    this.highlight.dispose();
    this.dim.dispose();
    this.glow.dispose();
    this.scene.clear();
  }
}
