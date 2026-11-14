import * as THREE from 'three';
import type { ContentRegistry, ThemeDef } from '../core/types';
import { TextureAtlas } from './atlas';
import { BlockLooks } from './blockLook';
import { ChunkRenderer } from './chunks';
import { BounceEffects } from './effects/bounce';
import { DimOverlay } from './effects/dim';
import { GlowLights } from './effects/glowLights';
import { Highlight } from './effects/highlight';
import { Particles } from './effects/particles';
import { Clouds } from './scene/clouds';
import { IslandUnderside } from './scene/island';
import { Lights } from './scene/lights';
import { Sky } from './scene/sky';
import { VoxelMirror } from './voxelMirror';

/** Everything that lives in the 3D scene, created and disposed together. */
export class SceneGraph {
  readonly scene = new THREE.Scene();
  readonly mirror = new VoxelMirror();
  readonly looks: BlockLooks;
  readonly atlas: TextureAtlas;
  readonly chunks: ChunkRenderer;
  readonly sky = new Sky();
  readonly lights = new Lights();
  readonly clouds = new Clouds();
  readonly underside = new IslandUnderside();
  readonly particles = new Particles();
  readonly bounce: BounceEffects;
  readonly highlight: Highlight;
  readonly dim = new DimOverlay();
  readonly glow: GlowLights;

  constructor(registry: ContentRegistry, maxAnisotropy: number) {
    this.looks = new BlockLooks(registry);
    this.atlas = new TextureAtlas(maxAnisotropy);
    this.chunks = new ChunkRenderer(this.mirror, this.atlas, this.looks);
    this.bounce = new BounceEffects(this.looks, (cell, hidden) => this.chunks.setHidden(cell, hidden));
    this.highlight = new Highlight(this.looks);
    this.glow = new GlowLights(this.mirror, this.looks);
    this.scene.add(
      this.sky.group,
      this.lights.group,
      this.clouds.group,
      this.underside.group,
      this.chunks.group,
      this.particles.mesh,
      this.bounce.group,
      this.highlight.group,
      this.glow.group,
      this.dim.mesh,
    );
  }

  setTheme(theme: ThemeDef): void {
    this.sky.setTheme(theme);
    this.lights.setSkyTint(theme.sky.top);
    this.clouds.setColor(theme.cloudColor);
    this.underside.setTheme(theme);
    this.scene.fog = new THREE.Fog(new THREE.Color(theme.sky.bottom), 90, 260);
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
    this.chunks.dispose();
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
