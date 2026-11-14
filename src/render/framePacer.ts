/**
 * Decides which display frames to render. While anything moves (gesture, camera fly, particles,
 * bounce, highlight pulse, dim fade) every frame renders; when only the slow clouds drift, the
 * loop drops to ~30 fps to save battery and heat. Pure: feed it timestamps in milliseconds.
 */
export const IDLE_FPS = 30;
/** Input or a requested frame keeps the loop at full rate for this long. */
export const KICK_MS = 500;
/** Display frames arrive with jitter; render an idle frame slightly early rather than skip it. */
const JITTER_MS = 4;

export interface PacedFrame {
  /** The frame time reflects device speed (full-rate before and now), so quality may sample it. */
  readonly measure: boolean;
}

export class FramePacer {
  private lastRenderAt = Number.NEGATIVE_INFINITY;
  private kickedAt = Number.NEGATIVE_INFINITY;
  private lastBusy = false;

  constructor(
    private readonly idleIntervalMs = 1000 / IDLE_FPS,
    private readonly kickMs = KICK_MS,
  ) {}

  /** Something happened (input, world change, effect started): render smoothly for a while. */
  kick(now: number): void {
    this.kickedAt = now;
  }

  /** Returns null to skip this display frame. */
  next(now: number, animating: boolean): PacedFrame | null {
    const busy = animating || now - this.kickedAt < this.kickMs;
    if (!busy && now - this.lastRenderAt < this.idleIntervalMs - JITTER_MS) return null;
    const measure = busy && this.lastBusy;
    this.lastBusy = busy;
    this.lastRenderAt = now;
    return { measure };
  }
}
